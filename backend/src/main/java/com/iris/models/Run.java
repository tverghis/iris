package com.iris.models;

import java.time.Instant;

public record Run(
    long id,
    long taskId,
    String executor,
    String model,
    State state,
    String leaseToken,
    Instant leaseExpiresAt,
    Instant lastHeartbeatAt,
    String summary,
    String error,
    Long costMicrousd,
    String logRef,
    Instant startedAt,
    Instant endedAt) {
  public enum State {
    RUNNING,
    SUCCEEDED,
    NEEDS_HUMAN,
    FAILED,
    TIMED_OUT,
    CANCELLED
  }
}
