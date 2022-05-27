import * as aws from "@pulumi/aws";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

// getFileHash calculates a hash for all of the files under the scripts directory.
export function getFileHash(filename: string): string {
    const data = fs.readFileSync(path.join(__dirname, filename), {encoding: "utf8"});
    const hash = crypto.createHash("md5").update(data, "utf8");
    return hash.digest("hex");
}

// Split a domain name into its subdomain and parent domain names.
// e.g. "www.example.com" => "www", "example.com".
export function getDomainAndSubdomain(domain: string): { subdomain: string, parentDomain: string } {
    const parts = domain.split(".");
    if (parts.length < 2) {
        throw new Error(`No TLD found on ${domain}`);
    }
    // No subdomain, e.g. awesome-website.com.
    if (parts.length === 2) {
        return { subdomain: "", parentDomain: domain };
    }

    const subdomain = parts[0];
    parts.shift();  // Drop first element.
    return {
        subdomain,
        // Trailing "." to canonicalize domain.
        parentDomain: parts.join(".") + ".",
    };
}

// Creates a new Route53 DNS CNAME record
export function createCnameRecord(
    targetDomain: string, eip: aws.ec2.Eip): aws.route53.Record {
    const domainParts = getDomainAndSubdomain(targetDomain);
    const hostedZoneId = aws.route53.getZone({ name: domainParts.parentDomain }, { async: true }).then(zone => zone.zoneId);
    return new aws.route53.Record(
        targetDomain,
        {
            name: domainParts.subdomain,
            zoneId: hostedZoneId,
            type: "CNAME",
            ttl: 300,
            records: [eip.domainName],
        });
}