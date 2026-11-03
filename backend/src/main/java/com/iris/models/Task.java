package com.iris.models;

import java.time.Instant;

public record Task(
    long id,
    long projectId,
    String title,
    String descriptionMd,
    Status status,
    Long assigneeUserId,
    String outputMd,
    int attempts,
    boolean requireSignOff,
    long createdByUserId,
    Instant createdAt,
    Instant updatedAt,
    Instant doneAt) {
  public enum Status {
    BACKLOG,
    READY,
    IN_PROGRESS,
    NEEDS_APPROVAL,
    BLOCKED,
    DONE
  }
}
