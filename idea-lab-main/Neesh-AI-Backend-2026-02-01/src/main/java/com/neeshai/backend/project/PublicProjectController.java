package com.neeshai.backend.project;

import com.neeshai.backend.audience.AudienceDTOs;
import com.neeshai.backend.audience.AudienceService;
import com.neeshai.backend.blog.BlogDTOs;
import com.neeshai.backend.blog.BlogService;
import com.neeshai.backend.projectlink.ProjectLinkService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.beans.factory.annotation.Value;

import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/public/projects")
public class PublicProjectController {

    private static final Logger logger = LoggerFactory.getLogger(PublicProjectController.class);

    @Value("${ai.service.url:http://localhost:3000}")
    private String aiServiceUrl;

    @Value("${ai.service.internal-api-key:neesh-ai-secret-key-123}")
    private String aiServiceInternalApiKey;

    private final ProjectService projectService;
    private final BlogService blogService;
    private final AudienceService audienceService;
    private final ProjectLinkService projectLinkService;
    private final RestTemplate restTemplate;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public PublicProjectController(ProjectService projectService, BlogService blogService,
            AudienceService audienceService, ProjectLinkService projectLinkService,
            RestTemplate restTemplate, org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.projectService = projectService;
        this.blogService = blogService;
        this.audienceService = audienceService;
        this.projectLinkService = projectLinkService;
        this.restTemplate = restTemplate;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/dump-documents")
    public ResponseEntity<java.util.List<java.util.Map<String, Object>>> dumpDocuments() {
        return ResponseEntity.ok(jdbcTemplate.queryForList("SELECT * FROM documents"));
    }

    @GetMapping("/{slug}")
    public ResponseEntity<ProjectDTOs.PublicProjectDTO> getPublicProject(@PathVariable String slug) {
        return projectService.getPublicProject(slug)
                .map(ProjectDTOs.PublicProjectDTO::fromEntity)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{projectId}/blog")
    public ResponseEntity<BlogDTOs.BlogContentDTO> getPublicBlog(@PathVariable UUID projectId) {
        // Get blog content without owner verification for public access
        return blogService.getBlogContent(projectId, null)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{projectId}/feedback")
    public ResponseEntity<AudienceDTOs.PublicFeedbackResponse> submitFeedback(
            @PathVariable UUID projectId,
            @RequestBody AudienceDTOs.PublicFeedbackRequest request) {
        return ResponseEntity.ok(audienceService.submitPublicFeedback(projectId, request));
    }

    @PostMapping("/{projectId}/chat")
    public ResponseEntity<Map<String, Object>> publicChat(
            @PathVariable UUID projectId,
            @RequestBody Map<String, Object> request) {

        String query = (String) request.get("query");
        String userName = (String) request.get("userName");
        String userEmail = (String) request.get("userEmail");
        String sessionId = (String) request.get("sessionId");
        Object chatHistory = request.get("chat_history");
        
        logger.info("[PublicChat] POST /api/public/projects/{}/chat - query length: {}",
                projectId, query != null ? query.length() : 0);

        if (query == null || query.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
        }

        try {
            List<UUID> linkedProjectIds = projectLinkService.getLinkedProjectIds(projectId);

            String url = aiServiceUrl + "/internal/chat";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-internal-secret", aiServiceInternalApiKey);

            Map<String, Object> body = new HashMap<>();
            body.put("projectId", projectId.toString());
            body.put("query", query);
            if (userName != null && !userName.isBlank()) {
                body.put("userName", userName);
            }
            if (userEmail != null && !userEmail.isBlank()) {
                body.put("userEmail", userEmail);
            }
            if (chatHistory != null) {
                body.put("chat_history", chatHistory);
            }
            if (!linkedProjectIds.isEmpty()) {
                body.put("linkedProjectIds", linkedProjectIds.stream()
                        .map(UUID::toString)
                        .collect(Collectors.toList()));
            }

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
            
            logger.info("[PublicChat] Forwarding request to AI Service: {} with projectId: {}", url, projectId);
            
            // Use String.class first to avoid Jackson deserialization issues if the response is not valid JSON
            ResponseEntity<String> responseEntity = restTemplate.postForEntity(url, entity, String.class);

            logger.info("[PublicChat] AI service responded with status: {}", responseEntity.getStatusCode());
            String rawResponseBody = responseEntity.getBody();
            logger.debug("[PublicChat] Raw response body from AI service: {}", rawResponseBody);

            if (rawResponseBody == null || rawResponseBody.trim().isEmpty()) {
                throw new RuntimeException("AI Service returned an empty response body");
            }

            // Parse the string into a Map manually
            Map<String, Object> responseMap;
            try {
                responseMap = new com.fasterxml.jackson.databind.ObjectMapper().readValue(rawResponseBody, Map.class);
            } catch (Exception e) {
                logger.error("[PublicChat] Failed to parse AI service response as JSON. Raw body: {}", rawResponseBody);
                return ResponseEntity.status(500).body(Map.of(
                        "status", "NO_ANSWER",
                        "error", "AI Service Invalid Response",
                        "details", "The AI service returned a non-JSON response: " + (rawResponseBody.length() > 100 ? rawResponseBody.substring(0, 100) + "..." : rawResponseBody)));
            }

            // Save the chat interaction to audience_questions table
            try {
                String answer = null;
                if (responseMap.get("answer") != null) {
                    answer = responseMap.get("answer").toString();
                }
                audienceService.recordChatInteraction(projectId,
                        new AudienceDTOs.ChatInteractionRequest(query, answer, userName, userEmail, sessionId));
            } catch (Exception e) {
                logger.warn("[PublicChat] Failed to record chat interaction: {}", e.getMessage());
                // Don't fail the chat response if recording fails
            }

            return ResponseEntity.ok(responseMap);

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            logger.error("[PublicChat] AI service returned error status {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            return ResponseEntity.status(e.getStatusCode()).body(Map.of(
                    "error", "AI Service Error",
                    "details", e.getResponseBodyAsString()));
        } catch (org.springframework.web.client.ResourceAccessException e) {
            logger.error("[PublicChat] Connection error (possible timeout) while calling AI service: {}", e.getMessage());
            return ResponseEntity.status(504).body(Map.of(
                    "status", "NO_ANSWER",
                    "error", "AI Service Timeout",
                    "details", "The AI service is taking too long to respond. Please try again in 10-20 seconds."));
        } catch (Throwable e) {
            logger.error("[PublicChat] FATAL ERROR: {}", e.getMessage(), e);
            java.io.StringWriter sw = new java.io.StringWriter();
            java.io.PrintWriter pw = new java.io.PrintWriter(sw);
            e.printStackTrace(pw);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to process chat request",
                    "message", e.getMessage(),
                    "stackTrace", sw.toString().substring(0, Math.min(2000, sw.toString().length()))));
        }
    }

}
