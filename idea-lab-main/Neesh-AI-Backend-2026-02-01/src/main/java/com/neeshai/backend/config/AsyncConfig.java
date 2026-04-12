package com.neeshai.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

/**
 * AsyncConfig
 * 
 * Provides a managed thread pool for asynchronous tasks (e.g. AI Ingestion).
 * This prevents resource exhaustion by limiting the number of concurrent threads.
 * Sized for 5,000+ total users with moderate burst concurrency.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "aiIngestionExecutor")
    public Executor aiIngestionExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);     // Minimum active threads
        executor.setMaxPoolSize(20);      // Max threads for bursts
        executor.setQueueCapacity(500);   // Queue for pending tasks
        executor.setThreadNamePrefix("ai-ingest-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.initialize();
        return executor;
    }
}
