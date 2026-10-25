package com.iris.properties.validation;

import com.iris.properties.AgentRunProperties;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ExecutorValidator
    implements ConstraintValidator<ValidExecutor, AgentRunProperties.Executor> {

  @Override
  public boolean isValid(
      AgentRunProperties.Executor executor, ConstraintValidatorContext constraintValidatorContext) {
    if (executor == null || executor.type() == null) {
      return false;
    }

    return switch (executor.type()) {
      case MOCK -> true;
      case HERMES_WEBHOOK ->
          executor.uri() != null
              && present(executor.secret())
              && present(executor.modelIdentifier())
              && present(executor.mcpBearerToken());
    };
  }

  private static boolean present(String value) {
    return value != null && !value.isEmpty();
  }
}
