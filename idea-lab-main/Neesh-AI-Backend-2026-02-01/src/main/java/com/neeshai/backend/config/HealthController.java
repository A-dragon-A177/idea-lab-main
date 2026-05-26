package com.neeshai.backend.config;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Public health check endpoint for Render keep-alive pings
 * and frontend warmup requests. Responds instantly without
 * touching the database.
 */
@RestController
public class HealthController {

    private static final Instant START_TIME = Instant.now();

    @GetMapping("/api/public/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "uptime", java.time.Duration.between(START_TIME, Instant.now()).toSeconds()
        ));
    }
}
