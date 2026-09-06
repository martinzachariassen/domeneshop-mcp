package domeneshop

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// Forward represents an HTTP forward for a subdomain.
type Forward struct {
	Host  string `json:"host"`
	Frame bool   `json:"frame"`
	URL   string `json:"url"`
}

// ListForwards lists all HTTP forwards for a domain.
func (c *Client) ListForwards(ctx context.Context, domainID int) ([]Forward, error) {
	var forwards []Forward
	path := fmt.Sprintf("/domains/%d/forwards/", domainID)
	if _, err := c.request(ctx, "GET", path, nil, nil, &forwards); err != nil {
		return nil, err
	}
	return forwards, nil
}

// GetForward retrieves the HTTP forward for a specific host.
func (c *Client) GetForward(ctx context.Context, domainID int, host string) (*Forward, error) {
	var forward Forward
	if _, err := c.request(ctx, "GET", forwardPath(domainID, host), nil, nil, &forward); err != nil {
		return nil, err
	}
	return &forward, nil
}

// CreateForward creates a new HTTP forward.
//
// The API answers 201 with an empty body, naming the new forward only in the
// Location header, so the result is the submitted forward with its host taken
// from that header when present.
func (c *Client) CreateForward(ctx context.Context, domainID int, forward Forward) (*Forward, error) {
	path := fmt.Sprintf("/domains/%d/forwards/", domainID)
	header, err := c.request(ctx, "POST", path, nil, forward, nil)
	if err != nil {
		return nil, err
	}
	created := forward
	if loc := header.Get("Location"); loc != "" {
		if host := hostFromLocation(loc); host != "" {
			created.Host = host
		}
	}
	return &created, nil
}

// UpdateForward updates an existing HTTP forward.
func (c *Client) UpdateForward(ctx context.Context, domainID int, host string, forward Forward) (*Forward, error) {
	var updated Forward
	if _, err := c.request(ctx, "PUT", forwardPath(domainID, host), nil, forward, &updated); err != nil {
		return nil, err
	}
	return &updated, nil
}

// DeleteForward deletes an HTTP forward.
func (c *Client) DeleteForward(ctx context.Context, domainID int, host string) error {
	_, err := c.request(ctx, "DELETE", forwardPath(domainID, host), nil, nil, nil)
	return err
}

// forwardPath builds the path for a single forward. The host is escaped: it is
// caller-supplied and reaches the URL as a path segment.
func forwardPath(domainID int, host string) string {
	return fmt.Sprintf("/domains/%d/forwards/%s", domainID, url.PathEscape(host))
}

// hostFromLocation extracts the forward host from a Location header, which
// points at the created forward's own URL.
func hostFromLocation(loc string) string {
	segment := loc[strings.LastIndex(loc, "/")+1:]
	host, err := url.PathUnescape(segment)
	if err != nil {
		return segment
	}
	return host
}
