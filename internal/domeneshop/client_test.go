package domeneshop

import (
	"context"
	"encoding/base64"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

// testClient starts an httptest server running handler and returns a Client
// pointed at it.
func testClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return NewClient("token", "secret", WithBaseURL(srv.URL))
}

func TestRequestSendsBasicAuthAndAccept(t *testing.T) {
	var gotAuth, gotAccept string
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotAccept = r.Header.Get("Accept")
		_, _ = w.Write([]byte("[]"))
	})

	if _, err := c.ListDomains(context.Background(), ""); err != nil {
		t.Fatal(err)
	}

	want := "Basic " + base64.StdEncoding.EncodeToString([]byte("token:secret"))
	if gotAuth != want {
		t.Errorf("Authorization = %q, want %q", gotAuth, want)
	}
	if gotAccept != "application/json" {
		t.Errorf("Accept = %q, want application/json", gotAccept)
	}
}

func TestRequestReturnsAPIError(t *testing.T) {
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":"authentication:failed"}`))
	})

	_, err := c.ListDomains(context.Background(), "")

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("error = %v, want *APIError", err)
	}
	if apiErr.StatusCode != http.StatusUnauthorized {
		t.Errorf("StatusCode = %d, want 401", apiErr.StatusCode)
	}
	if apiErr.Body != `{"code":"authentication:failed"}` {
		t.Errorf("Body = %q", apiErr.Body)
	}
}

// A 204 with no body must not be treated as a decode failure.
func TestRequestAcceptsEmptyBody(t *testing.T) {
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})

	if err := c.DeleteDNSRecord(context.Background(), 1, 2); err != nil {
		t.Fatal(err)
	}
}
