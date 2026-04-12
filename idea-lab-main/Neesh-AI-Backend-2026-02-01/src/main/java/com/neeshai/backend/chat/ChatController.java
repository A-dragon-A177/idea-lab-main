package com.neeshai.backend.chat;

import com.neeshai.backend.audience.AudienceDTOs;
import com.neeshai.backend.audience.AudienceService;
import com.neeshai.backend.apikey.UserApiKeyService;
import com.neeshai.backend.projectlink.ProjectLinkService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

    @Value("${ai.service.url:http://localhost:3000}")
    private String aiServiceUrl;

    private final RestTemplate restTemplate;
    private final ProjectLinkService projectLinkService;
    private final UserApiKeyService userApiKeyService;
    private final AudienceService audienceService;

    @Value("${ai.service.internal-api-key:neesh-ai-secret-key-123}")
    private String internalApiKey;

    public ChatController(ProjectLinkService projectLinkService, 
            UserApiKeyService userApiKeyService,
            AudienceService audienceService,
            RestTemplate restTemplate) {
        this.projectLinkService = projectLinkService;
        this.userApiKeyService = userApiKeyService;
        this.audienceService = audienceService;
        this.restTemplate = restTemplate;
    }

    private UUID getCurrentUserId() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof Jwt) {
            Jwt jwt = (Jwt) authentication.getPrincipal();
            return UUID.fromString(jwt.getSubject());
        }
        return null;
    }

    @PostMapping("/projects/{projectId}/chat")
    public ResponseEntity<Map<String, Object>> chatWithProject(
            @PathVariable UUID projectId,
            @RequestBody Map<String, Object> request) {

        String query = (String) request.get("query");
        String sessionId = (String) request.get("sessionId");
        Object chatHistory = request.get("chat_history");
        
        logger.info("[ChatController] POST /api/projects/{}/chat - Received chat query. Query length: {} chars",
                projectId, query != null ? query.length() : 0);

        if (query == null || query.trim().isEmpty()) {
            logger.warn("[ChatController] Empty query received for project {}", projectId);
            return ResponseEntity.badRequest().body(Map.of("error", "Query is required"));
        }

        try {
            // Fetch linked project IDs for knowledge sharing
            List<UUID> linkedProjectIds = projectLinkService.getLinkedProjectIds(projectId);
            logger.info("[ChatController] Found {} linked projects for knowledge sharing", linkedProjectIds.size());

            String url = aiServiceUrl + "/internal/chat";
            logger.info("[ChatController] Forwarding chat request to AI service: {}", url);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("x-internal-secret", internalApiKey); // Set via properties

            Map<String, Object> body = new HashMap<>();
            body.put("projectId", projectId.toString());
            body.put("query", query);
            if (chatHistory != null) {
                body.put("chat_history", chatHistory);
            }
            // Pass linked project IDs for cross-project knowledge sharing
            if (!linkedProjectIds.isEmpty()) {
                body.put("linkedProjectIds", linkedProjectIds.stream()
                        .map(UUID::toString)
                        .collect(Collectors.toList()));
            }

            // Fetch user's LLM provider and API key
            UUID userId = getCurrentUserId();
            if (userId != null) {
                Map<String, String> apiKeyConfig = userApiKeyService.getActiveConfig(userId);
                if (apiKeyConfig != null) {
                    body.put("provider", apiKeyConfig.get("provider"));
                    body.put("apiKey", apiKeyConfig.get("apiKey"));
                    logger.info("[ChatController] Using user's LLM provider: {}", apiKeyConfig.get("provider"));
                } else {
                    logger.info("[ChatController] No user API key configured, AI service will use fallback");
                }
            }

            logger.debug("[ChatController] Request payload to AI service: projectId={}, query={}, linkedProjects={}",
                    projectId, query, linkedProjectIds.size());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            // Use String.class first to avoid Jackson deserialization issues if the response is not valid JSON
            ResponseEntity<String> responseEntity = restTemplate.postForEntity(url, entity, String.class);

            logger.info("[ChatController] Received response from AI service. Status: {}", responseEntity.getStatusCode());
            String rawResponseBody = responseEntity.getBody();
            
            if (rawResponseBody == null || rawResponseBody.trim().isEmpty()) {
                throw new RuntimeException("AI Service returned an empty response body");
            }

            // Parse the string into a Map
            Map<String, Object> responseMap;
            try {
                responseMap = new com.fasterxml.jackson.databind.ObjectMapper().readValue(rawResponseBody, Map.class);
            } catch (Exception e) {
                logger.error("[ChatController] Failed to parse AI service response as JSON. Raw body: {}", rawResponseBody);
                throw new RuntimeException("AI Service returned invalid JSON: " + e.getMessage());
            }
            
            // Save the chat interaction to audience_questions table
            try {
                String answer = null;
                if (responseMap.get("answer") != null) {
                    answer = responseMap.get("answer").toString();
                }
                
                // Get user info from JWT if available
                String userName = "Admin User";
                String userEmail = "admin-test@neesh.ai";
                
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.getPrincipal() instanceof Jwt) {
                    Jwt jwt = (Jwt) authentication.getPrincipal();
                    userName = jwt.getClaimAsString("full_name") != null ? jwt.getClaimAsString("full_name") : "Admin User";
                    userEmail = jwt.getClaimAsString("email") != null ? jwt.getClaimAsString("email") : "admin-test@neesh.ai";
                }
                
                audienceService.recordChatInteraction(projectId,
                        new AudienceDTOs.ChatInteractionRequest(query, answer, userName, userEmail, sessionId));
            } catch (Exception e) {
                System.err.println("[ChatController] AI Service invocation or recording error: " + e.getMessage());
                String fallbackAnswer = "The AI service is currently experiencing high demand. Please try again in a moment.";
                if (e.getMessage() != null && e.getMessage().contains("invalid") && e.getMessage().contains("key")) {
                    fallbackAnswer = "AI configuration error: One or more API keys are invalid. Please check your settings.";
                }
                responseMap.put("answer", fallbackAnswer);
                responseMap.put("status", "NO_ANSWER");
            }

            return ResponseEntity.ok(responseMap);

        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            // Forward provider-specific errors from AI service
            logger.error("[ChatController] AI service returned error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            try {
                // Try to parse the error response from AI service
                Map errorBody = new com.fasterxml.jackson.databind.ObjectMapper()
                        .readValue(e.getResponseBodyAsString(), Map.class);
                return ResponseEntity.status(e.getStatusCode()).body(errorBody);
            } catch (Exception parseError) {
                return ResponseEntity.status(e.getStatusCode()).body(Map.of(
                        "error", "AI Service error",
                        "details", e.getResponseBodyAsString()));
            }
        } catch (org.springframework.web.client.ResourceAccessException e) {
            logger.error("[ChatController] Cannot connect to AI service at {}. Is the AI service running? Error: {}",
                    aiServiceUrl, e.getMessage());
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "AI Service is not available. Please ensure the AI service is running.",
                    "details", "Cannot connect to " + aiServiceUrl));
        } catch (Exception e) {
            logger.error("[ChatController] Error during chat processing for project {}: {}", projectId, e.getMessage(),
                    e);
            return ResponseEntity.internalServerError().body(Map.of(
                    "error", "Failed to communicate with AI Service",
                    "details", e.getMessage()));
        }
    }
}
