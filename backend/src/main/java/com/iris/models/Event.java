package com.iris.models;

import java.time.Instant;

public record Event(
    long id,
    long projectId,
    Long taskId,
    long userId,
    String type,
    String dataJson,
    Instant createdAt) {}
