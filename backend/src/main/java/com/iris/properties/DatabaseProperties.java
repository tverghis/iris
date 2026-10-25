package com.iris.properties;

import jakarta.validation.constraints.NotNull;
import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "iris.db")
public record DatabaseProperties(@NotNull Path path) {}
