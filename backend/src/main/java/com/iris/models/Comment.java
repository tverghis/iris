package com.iris.models;

import java.time.Instant;

public record Comment(
    long id,
    long taskId,
    long authorUserId,
    String bodyMd,
    Kind kind,
    Long replyToId,
    Instant resolvedAt,
    Instant createdAt,
    Instant updatedAt) {
  public enum Kind {
    COMMENT,
    QUESTION,
    ANSWER
  }
}
