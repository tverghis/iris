package com.iris.models;

import java.time.Instant;

public record Project(
    long id,
    String name,
    String briefMd,
    Instant archivedAt,
    Instant createdAt,
    Instant updatedAt) {}
