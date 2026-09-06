package domeneshop

import (
	"context"
	"net/url"
)

// UpdateDynDNS updates the DNS record for hostname to point at myip (or the
// caller's apparent IP address if myip is empty), using Domeneshop's
// dynamic DNS update protocol.
func (c *Client) UpdateDynDNS(ctx context.Context, hostname, myip string) error {
	query := url.Values{"hostname": {hostname}}
	if myip != "" {
		query.Set("myip", myip)
	}
	_, err := c.request(ctx, "GET", "/dyndns/update", query, nil, nil)
	return err
}
