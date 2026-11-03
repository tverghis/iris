package com.iris;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class IrisApplicationTests {

  @TempDir static Path databaseDirectory;

  @DynamicPropertySource
  static void databaseProperties(DynamicPropertyRegistry registry) {
    registry.add(
        "iris.database.path", () -> databaseDirectory.resolve("nested/iris.db").toString());
  }

  @Autowired private MockMvc mockMvc;

  @Test
  void returnsWelcomeMessage() throws Exception {
    MvcResult result = mockMvc.perform(get("/")).andReturn();

    assertThat(result.getResponse().getStatus()).isEqualTo(HttpStatus.OK.value());
    assertThat(result.getResponse().getContentAsString()).isEqualTo("Iris is running");
  }

  @Test
  void initializesDatabaseInMissingDirectory() {
    assertThat(databaseDirectory.resolve("nested/iris.db")).isRegularFile();
  }
}
