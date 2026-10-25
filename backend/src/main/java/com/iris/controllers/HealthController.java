package com.iris.controllers;

import com.iris.api.responses.HealthResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/healthz")
public class HealthController {

  @GetMapping
  public HealthResponse health() {
    return HealthResponse.HEALTHY;
  }
}
