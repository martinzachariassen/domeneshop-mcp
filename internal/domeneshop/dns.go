package domeneshop

import (
	"context"
	"fmt"
	"net/url"
)

// RecordTypes lists every DNS record type the Domeneshop API accepts.
//
// The published OpenAPI spec only documents A, AAAA, CNAME, MX, SRV, TLSA and
// TXT, but ANAME, CAA, DS and NS are equally supported — see the record
// validation in Domeneshop's own client libraries:
// https://github.com/domeneshop/domeneshop.js (src/lib/interfaces/dnsrecord.ts)
// and https://github.com/domeneshop/python-domeneshop (domeneshop/client.py).
var RecordTypes = []string{"A", "AAAA", "ANAME", "CAA", "CNAME", "DS", "MX", "NS", "SRV", "TLSA", "TXT"}

// DNSRecord represents a DNS record.
//
// Host, Type and Data apply to every record type; the remaining fields are
// type-specific and are omitted when unset. Data always carries the record's
// main value — the address, hostname, text or hash — while the numeric
// parameters below carry the rest.
type DNSRecord struct {
	ID   int    `json:"id,omitempty"`
	Host string `json:"host"`
	TTL  *int   `json:"ttl,omitempty"`
	Type string `json:"type"`
	Data string `json:"data"`

	// MX and SRV: preference, lower is tried first.
	Priority *int `json:"priority,omitempty"`
	// SRV only.
	Weight *int `json:"weight,omitempty"`
	Port   *int `json:"port,omitempty"`
	// TLSA only.
	Usage    *int `json:"usage,omitempty"`
	Selector *int `json:"selector,omitempty"`
	DType    *int `json:"dtype,omitempty"`
	// DS only: Alg is the signing algorithm, Digest the digest type.
	Alg    *int `json:"alg,omitempty"`
	Digest *int `json:"digest,omitempty"`
	// CAA only.
	Flags *int `json:"flags,omitempty"`
	// Tag is the key tag for DS and the property tag for CAA. It is typed as
	// any because the two uses differ and Domeneshop documents neither: their
	// TypeScript client declares both as numbers, but keeping the field
	// untyped means a record reads back losslessly whatever the API returns.
	Tag any `json:"tag,omitempty"`
}

// ListDNSRecords lists DNS records for a domain, optionally filtered by host
// and/or record type.
func (c *Client) ListDNSRecords(ctx context.Context, domainID int, host, recordType string) ([]DNSRecord, error) {
	query := url.Values{}
	if host != "" {
		query.Set("host", host)
	}
	if recordType != "" {
		query.Set("type", recordType)
	}
	var records []DNSRecord
	if _, err := c.request(ctx, "GET", fmt.Sprintf("/domains/%d/dns", domainID), query, nil, &records); err != nil {
		return nil, err
	}
	return records, nil
}

// GetDNSRecord retrieves a single DNS record.
func (c *Client) GetDNSRecord(ctx context.Context, domainID, recordID int) (*DNSRecord, error) {
	var record DNSRecord
	path := fmt.Sprintf("/domains/%d/dns/%d", domainID, recordID)
	if _, err := c.request(ctx, "GET", path, nil, nil, &record); err != nil {
		return nil, err
	}
	return &record, nil
}

// CreateDNSRecord creates a new DNS record and returns its ID.
func (c *Client) CreateDNSRecord(ctx context.Context, domainID int, record DNSRecord) (int, error) {
	var created struct {
		ID int `json:"id"`
	}
	path := fmt.Sprintf("/domains/%d/dns", domainID)
	if _, err := c.request(ctx, "POST", path, nil, record, &created); err != nil {
		return 0, err
	}
	return created.ID, nil
}

// UpdateDNSRecord replaces an existing DNS record. Fields left unset on record
// are dropped from the stored record, so callers should send it in full.
func (c *Client) UpdateDNSRecord(ctx context.Context, domainID, recordID int, record DNSRecord) error {
	path := fmt.Sprintf("/domains/%d/dns/%d", domainID, recordID)
	_, err := c.request(ctx, "PUT", path, nil, record, nil)
	return err
}

// DeleteDNSRecord deletes a DNS record.
func (c *Client) DeleteDNSRecord(ctx context.Context, domainID, recordID int) error {
	path := fmt.Sprintf("/domains/%d/dns/%d", domainID, recordID)
	_, err := c.request(ctx, "DELETE", path, nil, nil, nil)
	return err
}
