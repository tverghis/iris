package com.iris.models;

public record TaskDependency(long taskId, long dependsOnTaskId) {}
