package com.iris.properties.validation;

import static org.assertj.core.api.Assertions.assertThat;

import com.iris.properties.AgentRunProperties;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;

public class NotifierValidatorTest {
  private static ValidatorFactory validatorFactory;
  private Validator validator;

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
  void typeNoneDoesNotRequireTopics() {

    var notifier =
        new AgentRunProperties.Notifier(AgentRunProperties.Notifier.Type.NONE, null, null);

    assertThat(validator.validate(notifier)).isEmpty();
  }

  @ParameterizedTest
  @NullAndEmptySource
  void typeNtfyRejectsNullTopics(List<String> topics) {

    var notifier =
        new AgentRunProperties.Notifier(AgentRunProperties.Notifier.Type.NTFY, topics, null);

    assertThat(validator.validate(notifier)).isNotEmpty();
  }
}
