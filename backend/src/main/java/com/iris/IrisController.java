package com.iris;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class IrisController {

  @GetMapping(value = "/", produces = MediaType.TEXT_PLAIN_VALUE)
  public String index() {
    return "Iris is running";
  }
}
