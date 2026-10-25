package com.iris.properties.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.*;

@Documented
@Constraint(validatedBy = ExecutorValidator.class)
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface ValidExecutor {

  String message() default "invalid executor configuration";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
