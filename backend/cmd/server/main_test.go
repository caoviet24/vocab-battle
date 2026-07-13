package main

import "testing"

func TestMustEnv(t *testing.T) {
	const name = "VOCAB_BATTLE_TEST_ENV"
	t.Setenv(name, "configured")
	if got := mustEnv(name); got != "configured" {
		t.Fatalf("mustEnv() = %q, want configured", got)
	}

	t.Setenv(name, "")
	defer func() {
		if recover() == nil {
			t.Fatal("mustEnv() did not panic for an empty variable")
		}
	}()
	mustEnv(name)
}
