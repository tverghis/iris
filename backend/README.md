# Iris backend

Spring Boot 4 application using Java 25, Spring MVC, and virtual threads.

## Prerequisites

- JDK 25

## Run

```sh
./mvnw spring-boot:run
```

The application listens on port `8080`. Request the welcome endpoint with:

```sh
curl http://localhost:8080/
```

## Verify

```sh
./mvnw verify
```

This runs the JUnit 5 tests and checks Java formatting. Apply Google Java style with:

```sh
./mvnw spotless:apply
```
