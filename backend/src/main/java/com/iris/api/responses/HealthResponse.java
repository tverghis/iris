package com.iris.api.responses;

public record HealthResponse(boolean ok) {
  public static final HealthResponse HEALTHY = new HealthResponse(true);
}
