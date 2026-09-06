package domeneshop

import (
	"context"
	"fmt"
	"net/url"
)

type Domain struct {
	ID             int            `json:"id"`
	Domain         string         `json:"domain"`
	ExpiryDate     string         `json:"expiry_date"`
	Nameservers    []string       `json:"nameservers"`
	Registrant     string         `json:"registrant"`
	RegisteredDate string         `json:"registered_date"`
	Renew          bool           `json:"renew"`
	Services       DomainServices `json:"services"`
	Status         string         `json:"status"`
}

type DomainServices struct {
	DNS       bool   `json:"dns"`
	Email     bool   `json:"email"`
	Registrar bool   `json:"registrar"`
	Webhotel  string `json:"webhotel"`
}

// ListDomains lists all domains on the account. If filter is non-empty, only
// domains matching it are returned.
func (c *Client) ListDomains(ctx context.Context, filter string) ([]Domain, error) {
	query := url.Values{}
	if filter != "" {
		query.Set("domain", filter)
	}
	var domains []Domain
	if _, err := c.request(ctx, "GET", "/domains", query, nil, &domains); err != nil {
		return nil, err
	}
	return domains, nil
}

// GetDomain retrieves a single domain by its Domeneshop domain ID.
func (c *Client) GetDomain(ctx context.Context, domainID int) (*Domain, error) {
	var domain Domain
	if _, err := c.request(ctx, "GET", fmt.Sprintf("/domains/%d", domainID), nil, nil, &domain); err != nil {
		return nil, err
	}
	return &domain, nil
}
