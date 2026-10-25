package com.iris.properties.validation;

import static org.assertj.core.api.Assertions.assertThat;

import com.iris.properties.AgentRunProperties;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.net.URI;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;

public class ExecutorValidatorTest {
  private static ValidatorFactory validatorFactory;
  private Validator validator;

  private static final URI WEBHOOK_URI = URI.create("https://example.com/webhook");
  private static final String SECRET = "foo";
  private static final String MODEL_IDENTIFIER = "openai/fake-model";
  private static final String MCP_BEARER_TOKEN = "token";

  @BeforeAll
  static void beforeAll() {
    validatorFactory = Validation.buildDefaultValidatorFactory();
  }

  @BeforeEach
  void beforeEach() {
    validator = validatorFactory.getValidator();
  }

  @AfterAll
  static void afterAll() {
    validatorFactory.close();
  }

  @Test
  void typeMockDoesNotRequireAdditionalConfig() {
    var executor =
        new AgentRunProperties.Executor(
            AgentRunProperties.Executor.Type.MOCK, null, null, null, null);

    assertThat(validator.validate(executor)).isEmpty();
  }

  @ParameterizedTest
  @NullAndEmptySource
  void typeWebhookRejectsMissingSecret(String secret) {
    var executor =
        new AgentRunProperties.Executor(
            AgentRunProperties.Executor.Type.HERMES_WEBHOOK,
            WEBHOOK_URI,
            secret,
            MODEL_IDENTIFIER,
            MCP_BEARER_TOKEN);

    assertThat(validator.validate(executor)).isNotEmpty();
  }

  @ParameterizedTest
  @NullAndEmptySource
  void typeWebhookRejectsMissingModelIdentifier(String modelIdentifier) {
    var executor =
        new AgentRunProperties.Executor(
            AgentRunProperties.Executor.Type.HERMES_WEBHOOK,
            WEBHOOK_URI,
            SECRET,
            modelIdentifier,
            MCP_BEARER_TOKEN);

    assertThat(validator.validate(executor)).isNotEmpty();
  }

  @ParameterizedTest
  @NullAndEmptySource
  void typeWebhookRejectsMissingMcpBearerToken(String mcpBearerToken) {
    var executor =
        new AgentRunProperties.Executor(
            AgentRunProperties.Executor.Type.HERMES_WEBHOOK,
            WEBHOOK_URI,
            SECRET,
            MODEL_IDENTIFIER,
            mcpBearerToken);

    assertThat(validator.validate(executor)).isNotEmpty();
  }
}
