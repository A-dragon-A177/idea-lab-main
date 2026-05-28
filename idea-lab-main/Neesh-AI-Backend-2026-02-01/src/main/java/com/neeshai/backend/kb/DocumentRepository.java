package com.neeshai.backend.kb;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    @Query("SELECT d FROM Document d WHERE d.projectId = :projectId AND d.active = true")
    List<Document> findByProjectIdAndActiveTrue(@Param("projectId") UUID projectId);

    @Query("SELECT d FROM Document d WHERE d.projectId = :projectId AND d.originalFilename = :originalFilename AND d.active = true")
    Optional<Document> findByProjectIdAndOriginalFilenameAndActiveTrue(@Param("projectId") UUID projectId, @Param("originalFilename") String originalFilename);
}
