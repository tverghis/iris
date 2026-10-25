package com.iris;

import com.iris.properties.AgentRunProperties;
import com.iris.properties.DatabaseProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties({DatabaseProperties.class, AgentRunProperties.class})
public class IrisApplication {

  static void main(String[] args) {
    SpringApplication.run(IrisApplication.class, args);
  }
}
