package com.iris.models;

import java.time.Instant;

public record User(long id, String name, String email, boolean isAgent, Instant createdAt) {}
