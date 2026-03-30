package com.neeshai.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.util.UUID;

public interface StorageService {
    /**
     * Uploads file to a specific deterministic destination path.
     * 
     * @param file            The file to upload
     * @param destinationPath The full storage path (e.g.
     *                        projects/{pid}/docs/{gid}/v1.pdf)
     * @return The stored path (same as destinationPath)
     */
    String uploadFile(MultipartFile file, String destinationPath);
}

@Service
class MockStorageService implements StorageService {
    @Override
    public String uploadFile(MultipartFile file, String destinationPath) {
        // In real impl, upload to Supabase bucket at 'destinationPath'
        // Simulating success
        System.out.println("Mock Uploading " + file.getOriginalFilename() + " to " + destinationPath);
        return destinationPath;
    }
}
