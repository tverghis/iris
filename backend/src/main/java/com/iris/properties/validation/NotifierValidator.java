package com.iris.properties.validation;

import com.iris.properties.AgentRunProperties;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class NotifierValidator
    implements ConstraintValidator<ValidNotifier, AgentRunProperties.Notifier> {

  @Override
  public boolean isValid(
      AgentRunProperties.Notifier notifier, ConstraintValidatorContext constraintValidatorContext) {

    if (notifier == null || notifier.type() == null) {
      // We're relying on the @NotNull annotation on the class itself for this.
      return true;
    }

    return switch (notifier.type()) {
      case NONE -> true;
      case NTFY -> (notifier.topics() != null) && (!notifier.topics().isEmpty());
    };
  }
}
