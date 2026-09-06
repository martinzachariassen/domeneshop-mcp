package mcpserver

import (
	"context"

	"github.com/martinzachariassen/domeneshop-mcp/internal/domeneshop"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerDNSTools(s *mcp.Server, client *domeneshop.Client) {
	type listDNSRecordsArgs struct {
		DomainID int    `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		Host     string `json:"host,omitempty" jsonschema:"only return records for this host/subdomain"`
		Type     string `json:"type,omitempty" jsonschema:"only return records of this type: A, AAAA, ANAME, CAA, CNAME, DS, MX, NS, SRV, TLSA or TXT"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_dns_records",
		Description: "List DNS records for a domain, optionally filtered by host and/or record type.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args listDNSRecordsArgs) (*mcp.CallToolResult, any, error) {
		records, err := client.ListDNSRecords(ctx, args.DomainID, args.Host, args.Type)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(records)
	})

	type getDNSRecordArgs struct {
		DomainID int `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		RecordID int `json:"record_id" jsonschema:"the DNS record ID, from list_dns_records"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_dns_record",
		Description: "Get a single DNS record by ID.",
		Annotations: readOnly(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args getDNSRecordArgs) (*mcp.CallToolResult, any, error) {
		record, err := client.GetDNSRecord(ctx, args.DomainID, args.RecordID)
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(record)
	})

	// Every record type takes host, type and data; the rest are type-specific
	// and must be supplied for exactly the types named in their descriptions.
	type dnsRecordArgs struct {
		DomainID int    `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		Host     string `json:"host" jsonschema:"the host/subdomain the record applies to, e.g. 'www' or '@' for the root"`
		Type     string `json:"type" jsonschema:"the record type"`
		Data     string `json:"data" jsonschema:"the record's main value: an IP address for A/AAAA, a hostname for ANAME/CNAME/MX/NS/SRV, free text for TXT, the CAA property value, or the hex hash for DS/TLSA"`
		TTL      *int   `json:"ttl,omitempty" jsonschema:"time-to-live in seconds, 60-604800, must be a multiple of 60, defaults to 3600"`
		Priority *int   `json:"priority,omitempty" jsonschema:"required for MX and SRV: preference value, lower is tried first"`
		Weight   *int   `json:"weight,omitempty" jsonschema:"required for SRV: relative weight among records with the same priority"`
		Port     *int   `json:"port,omitempty" jsonschema:"required for SRV: the port the service is found on"`
		Usage    *int   `json:"usage,omitempty" jsonschema:"required for TLSA: certificate usage (0 PKIX-TA, 1 PKIX-EE, 2 DANE-TA, 3 DANE-EE)"`
		Selector *int   `json:"selector,omitempty" jsonschema:"required for TLSA: what the hash is taken from (0 full certificate, 1 subject public key)"`
		DType    *int   `json:"dtype,omitempty" jsonschema:"required for TLSA: matching type of the hash in data (0 exact match, 1 SHA-256, 2 SHA-512)"`
		Alg      *int   `json:"alg,omitempty" jsonschema:"required for DS: the DNSSEC signing algorithm number"`
		Digest   *int   `json:"digest,omitempty" jsonschema:"required for DS: digest type of the hash in data (1 SHA-1, 2 SHA-256, 4 SHA-384)"`
		Flags    *int   `json:"flags,omitempty" jsonschema:"required for CAA: 128 to mark the property critical, otherwise 0"`
		Tag      any    `json:"tag,omitempty" jsonschema:"required for DS (the key tag of the referenced DNSKEY) and for CAA (the property tag, e.g. issue, issuewild or iodef)"`
	}
	toDomainRecord := func(a dnsRecordArgs) domeneshop.DNSRecord {
		return domeneshop.DNSRecord{
			Host:     a.Host,
			Type:     a.Type,
			Data:     a.Data,
			TTL:      a.TTL,
			Priority: a.Priority,
			Weight:   a.Weight,
			Port:     a.Port,
			Usage:    a.Usage,
			Selector: a.Selector,
			DType:    a.DType,
			Alg:      a.Alg,
			Digest:   a.Digest,
			Flags:    a.Flags,
			Tag:      a.Tag,
		}
	}
	recordTypeEnum := map[string][]string{"type": domeneshop.RecordTypes}

	mcp.AddTool(s, &mcp.Tool{
		Name:        "create_dns_record",
		Description: "Create a new DNS record for a domain. Returns the new record's ID.",
		InputSchema: inputSchema[dnsRecordArgs](recordTypeEnum),
		Annotations: additive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args dnsRecordArgs) (*mcp.CallToolResult, any, error) {
		id, err := client.CreateDNSRecord(ctx, args.DomainID, toDomainRecord(args))
		if err != nil {
			return nil, nil, err
		}
		return jsonResult(map[string]int{"id": id})
	})

	type updateDNSRecordArgs struct {
		dnsRecordArgs
		RecordID int `json:"record_id" jsonschema:"the DNS record ID to update, from list_dns_records"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name: "update_dns_record",
		Description: "Replace an existing DNS record. This overwrites the whole record, " +
			"so send every field it should keep: any omitted field is dropped, and " +
			"leaving out ttl resets it to the default 3600 seconds. " +
			"Read the record with get_dns_record first if you are changing only part of it.",
		InputSchema: inputSchema[updateDNSRecordArgs](recordTypeEnum),
		Annotations: destructive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args updateDNSRecordArgs) (*mcp.CallToolResult, any, error) {
		if err := client.UpdateDNSRecord(ctx, args.DomainID, args.RecordID, toDomainRecord(args.dnsRecordArgs)); err != nil {
			return nil, nil, err
		}
		return textResult("DNS record updated.")
	})

	type deleteDNSRecordArgs struct {
		DomainID int `json:"domain_id" jsonschema:"the Domeneshop domain ID, from list_domains"`
		RecordID int `json:"record_id" jsonschema:"the DNS record ID to delete, from list_dns_records"`
	}
	mcp.AddTool(s, &mcp.Tool{
		Name:        "delete_dns_record",
		Description: "Delete a DNS record.",
		Annotations: destructive(),
	}, func(ctx context.Context, req *mcp.CallToolRequest, args deleteDNSRecordArgs) (*mcp.CallToolResult, any, error) {
		if err := client.DeleteDNSRecord(ctx, args.DomainID, args.RecordID); err != nil {
			return nil, nil, err
		}
		return textResult("DNS record deleted.")
	})
}
