# Case 17: Code comments stating facts by exclusion and splicing clauses
Context: code-comments
## Input
# An empty list returns zero, not an error.
def total(items):
    # The timeout skips the retry entirely, no log entry either.
    # The limit is per host, not per request.
    # Overflow clamps to the maximum, the caller still sees a valid range.
    return run(items)
## Must flag
- "An empty list returns zero, not an error." (manufactured-drama: negation tail, the positive statement carries the fact)
- "The timeout skips the retry entirely, no log entry either." (manufactured-drama: negation tail, folds into "skips the retry and the log entry")
- "Overflow clamps to the maximum, the caller still sees a valid range." (comma splice, the connective is missing: "so the caller still sees a valid range")
## Must not flag
- "The limit is per host, not per request." (the contrast preempts a misreading the positive statement leaves open)
