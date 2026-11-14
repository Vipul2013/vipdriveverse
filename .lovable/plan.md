# SEO Sitemap for VIP DriveVerse

## What will change
- Add `/sitemap.xml` using the router's explicit inclusion decisions and the configured public HTTPS domain.
- Include indexable public pages and brand profiles from the existing curated brand list; exclude the private Dream Garage and unbounded car-detail URLs without a verified public catalog.
- Add a `Sitemap` directive to `robots.txt` while allowing normal crawling.

## Validation
- Check the generated XML and `robots.txt` locally, including URL uniqueness and sitemap content type.
- Run the project's build checks, publish the change, and verify the live URLs.
