package com.neeshai.backend.kb;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.jdbc.core.JdbcTemplate;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private static final Logger log = LoggerFactory.getLogger(DocumentController.class);
    private final DocumentService documentService;
    private final JdbcTemplate jdbcTemplate;

    public DocumentController(DocumentService documentService, JdbcTemplate jdbcTemplate) {
        this.documentService = documentService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping("/dump")
    public ResponseEntity<List<Map<String, Object>>> dumpDb() {
        return ResponseEntity.ok(jdbcTemplate.queryForList("SELECT * FROM documents"));
    }

    private UUID getUserIdFromJwt(Jwt jwt) {
        try {
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException e) {
            log.error("Failed to parse UUID from JWT subject: {}", jwt.getSubject());
            throw e;
        }
    }

    // Upload New
    @PostMapping("/project/{projectId}")
    public ResponseEntity<KnowledgeDocumentDTO> uploadNew(
            @PathVariable UUID projectId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = getUserIdFromJwt(jwt);
        Document doc = documentService.uploadNewDocument(projectId, userId, file);
        return ResponseEntity.ok(KnowledgeDocumentDTO.fromEntity(doc));
    }

    // Replace Existing
    @PutMapping("/{documentId}/replace")
    public ResponseEntity<KnowledgeDocumentDTO> replaceExisting(
            @PathVariable UUID documentId,
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = getUserIdFromJwt(jwt);
        Document doc = documentService.replaceDocument(documentId, userId, file);
        return ResponseEntity.ok(KnowledgeDocumentDTO.fromEntity(doc));
    }

    // List
    @GetMapping("/project/{projectId}")
    public ResponseEntity<?> listDocuments(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt) {
        try {
            return ResponseEntity.ok(documentService.getActiveDocuments(projectId));
        } catch (Exception e) {
            log.error("Failed to list documents", e);
            String cause = e.getCause() != null ? e.getCause().getMessage() : "No cause";
            return ResponseEntity.status(500).body(java.util.Map.of(
                "error", "Internal Server Error",
                "message", e.getMessage() != null ? e.getMessage() : e.getClass().getName(),
                "cause", cause
            ));
        }
    }

    @DeleteMapping("/{documentId}")
    public ResponseEntity<Void> deleteDocument(
            @PathVariable UUID documentId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = getUserIdFromJwt(jwt);
        documentService.deleteDocument(documentId, userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/project/{projectId}/refresh")
    public ResponseEntity<java.util.Map<String, String>> refreshDocuments(
            @PathVariable UUID projectId,
            @AuthenticationPrincipal Jwt jwt) {
        UUID userId = getUserIdFromJwt(jwt);
        documentService.refreshDocuments(projectId, userId);
        return ResponseEntity.ok(java.util.Map.of("status", "success"));
    }
}
