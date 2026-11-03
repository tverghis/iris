package com.iris.models;

import java.time.Instant;

public record Approval(
    long id,
    long taskId,
    long runId,
    Kind kind,
    long requestorUserId,
    String summary,
    String payloadMd,
    State state,
    Long decidedByUserId,
    String decisionComment,
    Instant createdAt,
    Instant decidedAt) {
  public enum Kind {
    SIGN_OFF,
    PROCEED
  }

  public enum State {
    PENDING,
    APPROVED,
    CHANGES_REQUESTED,
    REJECTED,
    CANCELLED
  }
}
