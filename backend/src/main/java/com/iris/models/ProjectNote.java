package com.iris.models;

import java.time.Instant;

public record ProjectNote(
    long id,
    long projectId,
    long authorUserId,
    String bodyMd,
    boolean pinned,
    Instant createdAt,
    Instant updatedAt) {}
