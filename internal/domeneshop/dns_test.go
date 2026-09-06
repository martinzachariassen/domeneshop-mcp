package domeneshop

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

func TestListDNSRecordsFilters(t *testing.T) {
	var gotPath, gotQuery string
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotQuery = r.URL.Path, r.URL.RawQuery
		w.Write([]byte("[]"))
	})

	if _, err := c.ListDNSRecords(context.Background(), 42, "www", "A"); err != nil {
		t.Fatal(err)
	}

	if gotPath != "/domains/42/dns" {
		t.Errorf("path = %q, want /domains/42/dns", gotPath)
	}
	if gotQuery != "host=www&type=A" {
		t.Errorf("query = %q, want host=www&type=A", gotQuery)
	}
}

// Records of every supported type must survive a read unchanged, including the
// type-specific fields the published OpenAPI spec leaves out.
func TestListDNSRecordsPreservesTypeSpecificFields(t *testing.T) {
	body := `[
	  {"id":1,"host":"@","ttl":3600,"type":"MX","data":"mx.example.com","priority":10},
	  {"id":2,"host":"_sip._tcp","type":"SRV","data":"sip.example.com","priority":10,"weight":100,"port":5060},
	  {"id":3,"host":"@","type":"TLSA","data":"ABCD","usage":3,"selector":1,"dtype":1},
	  {"id":4,"host":"@","type":"DS","data":"ABCD","tag":12345,"alg":13,"digest":2},
	  {"id":5,"host":"@","type":"CAA","data":"letsencrypt.org","flags":0,"tag":"issue"},
	  {"id":6,"host":"@","type":"ANAME","data":"example.com"},
	  {"id":7,"host":"sub","type":"NS","data":"ns1.example.com"}
	]`
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(body))
	})

	records, err := c.ListDNSRecords(context.Background(), 1, "", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 7 {
		t.Fatalf("got %d records, want 7", len(records))
	}

	byType := map[string]DNSRecord{}
	for _, r := range records {
		byType[r.Type] = r
	}

	if got := byType["MX"].Priority; got == nil || *got != 10 {
		t.Errorf("MX priority = %v, want 10", got)
	}
	srv := byType["SRV"]
	if srv.Weight == nil || *srv.Weight != 100 || srv.Port == nil || *srv.Port != 5060 {
		t.Errorf("SRV weight/port = %v/%v, want 100/5060", srv.Weight, srv.Port)
	}
	tlsa := byType["TLSA"]
	if tlsa.Usage == nil || *tlsa.Usage != 3 || tlsa.Selector == nil || *tlsa.Selector != 1 || tlsa.DType == nil || *tlsa.DType != 1 {
		t.Errorf("TLSA usage/selector/dtype = %v/%v/%v, want 3/1/1", tlsa.Usage, tlsa.Selector, tlsa.DType)
	}
	ds := byType["DS"]
	if ds.Alg == nil || *ds.Alg != 13 || ds.Digest == nil || *ds.Digest != 2 {
		t.Errorf("DS alg/digest = %v/%v, want 13/2", ds.Alg, ds.Digest)
	}
	if ds.Tag != float64(12345) {
		t.Errorf("DS tag = %v (%T), want 12345", ds.Tag, ds.Tag)
	}
	caa := byType["CAA"]
	if caa.Flags == nil || *caa.Flags != 0 {
		t.Errorf("CAA flags = %v, want 0", caa.Flags)
	}
	// A CAA tag arrives as a string here; the untyped field must keep it as one
	// rather than failing to decode.
	if caa.Tag != "issue" {
		t.Errorf("CAA tag = %v (%T), want \"issue\"", caa.Tag, caa.Tag)
	}
}

// Unset type-specific fields must not be sent, so a plain A record is not
// rejected for carrying an irrelevant priority of 0.
func TestCreateDNSRecordOmitsUnsetFields(t *testing.T) {
	var got map[string]any
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &got)
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte(`{"id":7}`))
	})

	id, err := c.CreateDNSRecord(context.Background(), 1, DNSRecord{
		Host: "www", Type: "A", Data: "192.0.2.1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if id != 7 {
		t.Errorf("id = %d, want 7", id)
	}

	want := map[string]any{"host": "www", "type": "A", "data": "192.0.2.1"}
	if len(got) != len(want) {
		t.Fatalf("body = %v, want exactly %v", got, want)
	}
	for k, v := range want {
		if got[k] != v {
			t.Errorf("body[%q] = %v, want %v", k, got[k], v)
		}
	}
}

func TestCreateDNSRecordSendsTypeSpecificFields(t *testing.T) {
	var got map[string]any
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &got)
		w.Write([]byte(`{"id":1}`))
	})

	flags, ttl := 0, 3600
	if _, err := c.CreateDNSRecord(context.Background(), 1, DNSRecord{
		Host: "@", Type: "CAA", Data: "letsencrypt.org", TTL: &ttl, Flags: &flags, Tag: "issue",
	}); err != nil {
		t.Fatal(err)
	}

	if got["flags"] != float64(0) {
		t.Errorf("flags = %v, want 0", got["flags"])
	}
	if got["tag"] != "issue" {
		t.Errorf("tag = %v, want issue", got["tag"])
	}
	if got["ttl"] != float64(3600) {
		t.Errorf("ttl = %v, want 3600", got["ttl"])
	}
}

// The record ID belongs in the path, not the body: the API declares it
// read-only.
func TestUpdateDNSRecordUsesRecordIDInPath(t *testing.T) {
	var gotPath, gotMethod string
	var got map[string]any
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotMethod = r.URL.Path, r.Method
		b, _ := io.ReadAll(r.Body)
		json.Unmarshal(b, &got)
		w.WriteHeader(http.StatusNoContent)
	})

	if err := c.UpdateDNSRecord(context.Background(), 42, 7, DNSRecord{
		Host: "www", Type: "A", Data: "192.0.2.2",
	}); err != nil {
		t.Fatal(err)
	}

	if gotMethod != http.MethodPut {
		t.Errorf("method = %s, want PUT", gotMethod)
	}
	if gotPath != "/domains/42/dns/7" {
		t.Errorf("path = %q, want /domains/42/dns/7", gotPath)
	}
	if _, ok := got["id"]; ok {
		t.Errorf("body carries read-only id: %v", got)
	}
}

// RecordTypes is what the tool schema offers clients, so it must stay in step
// with what Domeneshop accepts.
func TestRecordTypesCoversEveryDomeneshopType(t *testing.T) {
	want := []string{"A", "AAAA", "ANAME", "CAA", "CNAME", "DS", "MX", "NS", "SRV", "TLSA", "TXT"}
	if len(RecordTypes) != len(want) {
		t.Fatalf("RecordTypes = %v, want %v", RecordTypes, want)
	}
	for i, typ := range want {
		if RecordTypes[i] != typ {
			t.Errorf("RecordTypes[%d] = %q, want %q", i, RecordTypes[i], typ)
		}
	}
}
