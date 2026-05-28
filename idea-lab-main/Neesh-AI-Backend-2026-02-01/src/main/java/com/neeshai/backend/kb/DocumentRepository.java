package com.neeshai.backend.kb;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    // Find active documents for a project
    List<Document> findByProjectIdAndActiveTrue(UUID projectId);

    // Find specific active document (for replacement)
    Optional<Document> findByProjectIdAndOriginalFilenameAndActiveTrue(UUID projectId, String originalFilename);
}
