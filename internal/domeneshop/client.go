// Package domeneshop implements a minimal client for the Domeneshop API
// (https://api.domeneshop.no/docs/).
package domeneshop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const defaultBaseURL = "https://api.domeneshop.no/v0"

// Client is a Domeneshop API client authenticated via HTTP Basic Auth
// using an API token and secret from https://www.domeneshop.no/admin?view=api.
type Client struct {
	token      string
	secret     string
	baseURL    string
	httpClient *http.Client
}

// Option customises a Client.
type Option func(*Client)

// WithBaseURL overrides the API base URL. Intended for tests.
func WithBaseURL(u string) Option {
	return func(c *Client) { c.baseURL = strings.TrimSuffix(u, "/") }
}

// NewClient creates a Domeneshop API client.
func NewClient(token, secret string, opts ...Option) *Client {
	c := &Client{
		token:      token,
		secret:     secret,
		baseURL:    defaultBaseURL,
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

// APIError is returned for non-2xx responses from the Domeneshop API.
type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	if e.Body == "" {
		return fmt.Sprintf("domeneshop: unexpected status %d", e.StatusCode)
	}
	return fmt.Sprintf("domeneshop: unexpected status %d: %s", e.StatusCode, e.Body)
}

// request performs an HTTP request against the Domeneshop API.
// body, if non-nil, is marshalled as the JSON request body.
// out, if non-nil, receives the JSON response body.
// The response headers are returned, as some endpoints report their result
// there rather than in the body (see CreateForward).
func (c *Client) request(ctx context.Context, method, path string, query url.Values, body, out any) (http.Header, error) {
	u := c.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}

	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request body: %w", err)
		}
		reader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, u, reader)
	if err != nil {
		return nil, fmt.Errorf("build request: %w", err)
	}
	req.SetBasicAuth(c.token, c.secret)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("perform request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.Header, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return resp.Header, &APIError{StatusCode: resp.StatusCode, Body: string(respBody)}
	}

	if out != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, out); err != nil {
			return resp.Header, fmt.Errorf("decode response body: %w", err)
		}
	}

	return resp.Header, nil
}
