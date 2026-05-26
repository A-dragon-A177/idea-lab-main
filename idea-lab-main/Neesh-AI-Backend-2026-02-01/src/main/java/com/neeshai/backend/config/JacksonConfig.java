package com.neeshai.backend.config;

import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;

/**
 * Increases Jackson's max string length from 20 MB to 100 MB.
 * This is a safety net for existing base64 media that hasn't been
 * migrated to Supabase Storage yet. New uploads go directly to
 * Storage, so this limit will rarely be hit going forward.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public ObjectMapper objectMapper(Jackson2ObjectMapperBuilder builder) {
        ObjectMapper mapper = builder.build();
        mapper.getFactory().setStreamReadConstraints(
                StreamReadConstraints.builder()
                        .maxStringLength(100_000_000) // 100 MB
                        .build()
        );
        return mapper;
    }
}
