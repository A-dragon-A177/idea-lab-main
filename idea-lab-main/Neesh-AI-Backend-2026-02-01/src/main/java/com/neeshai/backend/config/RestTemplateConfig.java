package com.neeshai.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * Shared RestTemplate bean with connection and read timeouts.
 * Used by controllers that call the AI service or other external APIs.
 */
@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);   // 5 seconds
        factory.setReadTimeout(90000);     // 90 seconds
        return new RestTemplate(factory);
    }
}
