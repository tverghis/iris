package com.iris.properties.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = NotifierValidator.class)
@Target(ElementType.TYPE)
public @interface ValidNotifier {
  String message() default "invalid notifier configuration";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
