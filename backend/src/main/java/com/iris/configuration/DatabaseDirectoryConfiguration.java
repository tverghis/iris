package com.iris.configuration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.beans.factory.BeanInitializationException;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration(proxyBeanMethods = false)
public class DatabaseDirectoryConfiguration {

  @Bean
  static BeanFactoryPostProcessor databaseDirectoryInitializer(Environment environment) {
    // Run before singleton creation, including the auto-configured datasource and Flyway.
    return beanFactory -> {
      Path directory =
          Path.of(environment.getRequiredProperty("iris.database.path"))
              .toAbsolutePath()
              .getParent();
      try {
        Files.createDirectories(directory);
      } catch (IOException e) {
        throw new BeanInitializationException(
            "Unable to create SQLite database directory: " + directory, e);
      }
    };
  }
}
