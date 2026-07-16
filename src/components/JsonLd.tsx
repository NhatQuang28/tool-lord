/**
 * Renders one or more JSON-LD structured-data blocks. Server component: it just
 * emits <script type="application/ld+json">. Pass a single object or an array.
 */
export function JsonLd({
  data,
  nonce,
}: {
  data: object | object[];
  /** CSP nonce so these inline scripts are allowed under the strict policy. */
  nonce?: string;
}) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          nonce={nonce}
          // JSON.stringify output is safe here (no user-controlled HTML).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
