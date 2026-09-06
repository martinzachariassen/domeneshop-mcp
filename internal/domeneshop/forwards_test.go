package domeneshop

import (
	"context"
	"net/http"
	"testing"
)

// POST /forwards/ answers 201 with an empty body, so the result has to be
// assembled from the request plus the Location header.
func TestCreateForwardReadsHostFromLocation(t *testing.T) {
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Location", "/domains/42/forwards/www")
		w.WriteHeader(http.StatusCreated)
	})

	forward, err := c.CreateForward(context.Background(), 42, Forward{
		Host: "www", URL: "https://example.com", Frame: false,
	})
	if err != nil {
		t.Fatal(err)
	}

	if forward.Host != "www" {
		t.Errorf("Host = %q, want www", forward.Host)
	}
	if forward.URL != "https://example.com" {
		t.Errorf("URL = %q, want https://example.com", forward.URL)
	}
}

// Without a Location header the submitted forward is still the right answer —
// what must not happen is returning an empty object.
func TestCreateForwardFallsBackToRequest(t *testing.T) {
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	})

	forward, err := c.CreateForward(context.Background(), 42, Forward{
		Host: "shop", URL: "https://example.com/shop", Frame: true,
	})
	if err != nil {
		t.Fatal(err)
	}

	if forward.Host != "shop" || forward.URL != "https://example.com/shop" || !forward.Frame {
		t.Errorf("forward = %+v, want the submitted values", *forward)
	}
}

func TestForwardPathEscapesHost(t *testing.T) {
	var gotPath string
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.WriteHeader(http.StatusNoContent)
	})

	// "@" is the root host and the one Domeneshop uses most; it must survive
	// unmangled, as must a host that needs escaping.
	if err := c.DeleteForward(context.Background(), 42, "@"); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/domains/42/forwards/@" {
		t.Errorf("path = %q, want /domains/42/forwards/@", gotPath)
	}

	if err := c.DeleteForward(context.Background(), 42, "a b"); err != nil {
		t.Fatal(err)
	}
	if gotPath != "/domains/42/forwards/a b" {
		t.Errorf("decoded path = %q, want /domains/42/forwards/a b", gotPath)
	}
}
