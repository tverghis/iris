package com.iris.properties;

import com.iris.properties.validation.ValidExecutor;
import com.iris.properties.validation.ValidNotifier;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.hibernate.validator.constraints.time.DurationMax;
import org.hibernate.validator.constraints.time.DurationMin;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "iris.agent-run")
public record AgentRunProperties(
    @NotNull @Valid Dispatch dispatch,
    @NotNull @Valid Lease lease,
    @NotNull @DurationMax(hours = 2) Duration maxAllowedDuration,
    @Positive @Max(value = 10) long maxAttempts,
    @NotNull @Valid Executor executor,
    @NotNull @Valid Notifier notifier) {

  public record Dispatch(
      @NotNull @DurationMin(minutes = 1) @DurationMax(days = 1) Duration interval) {}

  public record Lease(
      @NotNull @DurationMin(seconds = 30) @DurationMax(minutes = 10) Duration initialDuration,
      @NotNull @DurationMin(minutes = 1) @DurationMax(hours = 3) Duration extensionDuration) {}

  @ValidExecutor
  public record Executor(
      @NotNull Type type, URI uri, String secret, String modelIdentifier, String mcpBearerToken) {
    public enum Type {
      MOCK,
      HERMES_WEBHOOK
    }
  }

  @ValidNotifier
  public record Notifier(
      @NotNull Type type, List<@NotBlank String> topics, @Valid QuietHours quietHours) {
    public enum Type {
      NONE,
      NTFY
    }

    public record QuietHours(@Min(0) @Max(23) int startHourGmt, @Min(0) @Max(23) int endHourGmt) {}
  }
}
