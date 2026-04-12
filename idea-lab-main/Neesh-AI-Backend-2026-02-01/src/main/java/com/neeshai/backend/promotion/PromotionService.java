package com.neeshai.backend.promotion;

import com.neeshai.backend.blog.Blog;
import com.neeshai.backend.blog.BlogRepository;
import com.neeshai.backend.project.Project;
import com.neeshai.backend.user.User;
import com.neeshai.backend.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class PromotionService {

    private static final Logger log = LoggerFactory.getLogger(PromotionService.class);

    private final BlogPromotionRepository promotionRepository;
    private final BlogRepository blogRepository;
    private final UserRepository userRepository;

    public PromotionService(BlogPromotionRepository promotionRepository,
                            BlogRepository blogRepository,
                            UserRepository userRepository) {
        this.promotionRepository = promotionRepository;
        this.blogRepository = blogRepository;
        this.userRepository = userRepository;
    }

    /**
     * Submit a blog for promotion (Pro users only).
     */
    @Transactional
    public PromotionDTOs.PromotionDTO submitForPromotion(UUID userId, UUID projectId, List<String> tags) {
        // Validate user is Pro
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        String plan = user.getSubscriptionPlan();
        if (plan == null || "FREE".equalsIgnoreCase(plan)) {
            throw new IllegalArgumentException("Only Pro or Enterprise users can promote blogs. Please upgrade your plan.");
        }

        // Find blog for this project
        Blog blog = blogRepository.findByProjectId(projectId)
                .orElseThrow(() -> new IllegalArgumentException("No blog found for this project. Create a blog first."));

        // Check if already promoted
        Optional<BlogPromotion> existing = promotionRepository.findByBlogId(blog.getId());
        if (existing.isPresent()) {
            BlogPromotion promo = existing.get();
            if (!"ACTIVE".equals(promo.getStatus())) {
                promo.setStatus("ACTIVE");
                promotionRepository.save(promo);
                log.info("Re-activated promotion for blog: {} by user: {}", blog.getId(), userId);
            }
            return toDTO(promo, blog, Collections.emptyList());
        }

        // Create new promotion
        BlogPromotion promotion = new BlogPromotion(blog.getId(), userId);
        promotionRepository.save(promotion);

        log.info("Blog promoted: {} by user: {}", blog.getId(), userId);
        return toDTO(promotion, blog, Collections.emptyList());
    }

    /**
     * Get all promotions for a user.
     */
    public List<PromotionDTOs.PromotionDTO> getUserPromotions(UUID userId) {
        List<BlogPromotion> promotions = promotionRepository.findByUserIdAndStatus(userId, "ACTIVE");
        return promotions.stream().map(promo -> {
            Blog blog = blogRepository.findById(promo.getBlogId()).orElse(null);
            return toDTO(promo, blog, Collections.emptyList());
        }).collect(Collectors.toList());
    }

    /**
     * Remove a promotion.
     */
    @Transactional
    public void removePromotion(UUID userId, UUID promotionId) {
        log.info("[PromotionService] Received request to remove promotion with ID: {} from user: {}", promotionId, userId);
        BlogPromotion promo = promotionRepository.findById(promotionId)
                .orElseThrow(() -> {
                    log.error("[PromotionService] Promotion not found for ID: {}", promotionId);
                    return new IllegalArgumentException("Promotion not found");
                });

        if (!promo.getUserId().equals(userId)) {
            log.warn("[PromotionService] User {} not authorized to remove promotion {}", userId, promotionId);
            throw new IllegalArgumentException("Not authorized to remove this promotion");
        }

        promo.setStatus("REMOVED");
        promotionRepository.save(promo);
        log.info("[PromotionService] Promotion status successfully set to REMOVED for ID: {}", promotionId);
    }

    /**
     * Get similar blogs for "More Like This" section.
     * Returns random active promotions from the network.
     */
    public List<PromotionDTOs.SimilarBlogDTO> getSimilarBlogs(UUID projectId, int limit) {
        Optional<Blog> currentBlogOpt = blogRepository.findByProjectId(projectId);
        
        List<BlogPromotion> allActive = promotionRepository.findRandomActivePromotions(limit + 5);
        
        List<BlogPromotion> promotionsToShow;
        
        if (currentBlogOpt.isPresent()) {
            UUID currentBlogId = currentBlogOpt.get().getId();
            promotionsToShow = allActive.stream()
                    .filter(p -> !p.getBlogId().equals(currentBlogId))
                    .limit(limit)
                    .collect(Collectors.toList());
        } else {
            promotionsToShow = allActive.stream()
                    .limit(limit)
                    .collect(Collectors.toList());
        }

        return promotionsToShow.stream().map(simPromo -> {
            Blog simBlog = blogRepository.findById(simPromo.getBlogId()).orElse(null);
            if (simBlog == null) return null;

            Project simProject = simBlog.getProject();
            if (simProject == null) return null;

            User owner = userRepository.findById(simPromo.getUserId()).orElse(null);

            return new PromotionDTOs.SimilarBlogDTO(
                    simProject.getId(),
                    simBlog.getHeading() != null ? simBlog.getHeading() : simProject.getTitle(),
                    simProject.getOneLineSummary(),
                    simBlog.getCoverImageUrl(),
                    simProject.getSlug(),
                    owner != null ? owner.getName() : "Unknown",
                    Collections.emptyList()
            );
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    public long getPromotionCountForUser(UUID userId) {
        return promotionRepository.countByUserId(userId);
    }

    public List<String> getTagsForUser(UUID userId) {
        return Collections.emptyList();
    }

    private PromotionDTOs.PromotionDTO toDTO(BlogPromotion promo, Blog blog, List<String> tags) {
        return new PromotionDTOs.PromotionDTO(
                promo.getId(),
                promo.getBlogId(),
                blog != null ? blog.getProject().getId() : null,
                blog != null ? (blog.getHeading() != null ? blog.getHeading() : "Untitled") : "Unknown",
                blog != null ? blog.getCoverImageUrl() : null,
                tags,
                promo.getStatus(),
                promo.getCreatedAt()
        );
    }


    /**
     * Get branding info for a blog's public page.
     * Returns subscription plan, custom logo/text, and whether to show Neesh AI branding.
     */
    public PromotionDTOs.BlogBrandingDTO getBlogBranding(UUID projectId) {
        Optional<Blog> blogOpt = blogRepository.findByProjectId(projectId);
        if (blogOpt.isEmpty()) {
            return new PromotionDTOs.BlogBrandingDTO("FREE", null, null, true);
        }

        Blog blog = blogOpt.get();
        UUID ownerId = blog.getProject().getOwnerId();
        User owner = userRepository.findById(ownerId).orElse(null);

        if (owner == null) {
            return new PromotionDTOs.BlogBrandingDTO("FREE", null, null, true);
        }

        String plan = owner.getSubscriptionPlan() != null ? owner.getSubscriptionPlan() : "FREE";
        boolean isFree = "FREE".equalsIgnoreCase(plan);

        return new PromotionDTOs.BlogBrandingDTO(
                plan,
                isFree ? null : owner.getCustomLogoUrl(),
                isFree ? null : owner.getCustomBrandingText(),
                isFree // show Neesh AI branding for free users
        );
    }
}
