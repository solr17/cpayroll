import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ClinicPay",
  description:
    "ClinicPay Privacy Policy — how we collect, use, and protect personal data in compliance with Singapore PDPA.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose prose-slate prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-base prose-h3:mt-6 prose-p:leading-relaxed prose-li:leading-relaxed max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-slate-500">
        Effective Date: 1 April 2026 &middot; Last Updated: 1 April 2026
      </p>

      <p>
        This Privacy Policy describes how ClinicPay Pte. Ltd. (&quot;ClinicPay&quot;,
        &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects, uses, discloses, and protects
        personal data when you use the ClinicPay payroll platform (&quot;Service&quot;). This policy
        is drafted in compliance with the Personal Data Protection Act 2012 (&quot;PDPA&quot;) of
        Singapore.
      </p>

      {/* ── 1. Roles and Responsibilities ── */}
      <h2>1. Roles and Responsibilities</h2>
      <h3>1.1 Data Controller</h3>
      <p>
        Your organisation (the employer using ClinicPay) is the <strong>data controller</strong>{" "}
        responsible for determining the purposes and means of processing employee personal data. As
        the data controller, you are responsible for obtaining all necessary consents from your
        employees and ensuring lawful processing.
      </p>
      <h3>1.2 Data Intermediary</h3>
      <p>
        ClinicPay acts as a <strong>data intermediary</strong> (data processor) under the PDPA. We
        process personal data solely on your behalf and in accordance with your instructions, as
        defined by your use of the Service and these terms.
      </p>

      {/* ── 2. Personal Data We Collect ── */}
      <h2>2. Personal Data We Collect</h2>
      <h3>2.1 Employee Data (provided by you)</h3>
      <p>
        When you use the Service to manage payroll, you provide us with employee personal data
        including:
      </p>
      <ul>
        <li>
          <strong>Identity information:</strong> full name, date of birth, gender, nationality,
          citizenship status, and PR graduation year.
        </li>
        <li>
          <strong>National identification:</strong> NRIC or FIN number (see Section 3 for how this
          is protected).
        </li>
        <li>
          <strong>Employment information:</strong> job title, department, employment type, start
          date, end date, and salary details.
        </li>
        <li>
          <strong>Financial information:</strong> bank account details for salary payment, CPF
          contribution history, and tax-related data.
        </li>
        <li>
          <strong>Contact information:</strong> email address, phone number, and residential
          address.
        </li>
      </ul>
      <h3>2.2 Company Data</h3>
      <p>
        Company name, UEN, registered address, CPF submission number, bank account details, and
        authorised user information.
      </p>
      <h3>2.3 Account Data</h3>
      <p>
        Name, email address, password (hashed, never stored in plaintext), role assignments, and
        two-factor authentication (TOTP) configuration.
      </p>
      <h3>2.4 Usage Data</h3>
      <p>
        We automatically collect technical and usage data including IP addresses, browser type,
        device information, pages visited, actions performed (via our audit trail), and timestamps.
        This data is used for security monitoring, troubleshooting, and service improvement.
      </p>

      {/* ── 3. How We Protect NRIC/FIN ── */}
      <h2>3. Protection of NRIC/FIN Numbers</h2>
      <p>
        In accordance with the PDPA Advisory Guidelines on the collection of NRIC numbers, ClinicPay
        implements the following safeguards:
      </p>
      <ul>
        <li>
          <strong>HMAC-SHA256 hashing:</strong> Full NRIC/FIN numbers are hashed using HMAC-SHA256
          with a secret key. The hash is used for lookup and deduplication purposes. The full NRIC
          is never stored in plaintext in our database.
        </li>
        <li>
          <strong>Last 4 characters only:</strong> Only the last 4 characters of the NRIC/FIN (e.g.,
          &quot;567A&quot;) are stored separately and used for display in the user interface.
        </li>
        <li>
          <strong>No logging:</strong> Full NRIC/FIN numbers are never written to application logs,
          error messages, or monitoring systems.
        </li>
      </ul>

      {/* ── 4. How We Protect Financial Data ── */}
      <h2>4. Protection of Financial and Sensitive Data</h2>
      <ul>
        <li>
          <strong>Bank account details:</strong> Encrypted at rest using AES-256-GCM with unique
          encryption keys. Decryption occurs only at the point of use (e.g., generating bank GIRO
          files).
        </li>
        <li>
          <strong>Residential addresses:</strong> Encrypted at rest using AES-256-GCM.
        </li>
        <li>
          <strong>Salary records:</strong> Stored as immutable records. New salary entries create
          new rows with effective dates — existing records are never modified or deleted.
        </li>
        <li>
          <strong>Audit trail:</strong> All data mutations are logged in an append-only audit log
          that cannot be modified or deleted. This ensures a complete history of all changes for
          compliance purposes.
        </li>
        <li>
          <strong>Transport encryption:</strong> All data in transit is encrypted using TLS 1.2 or
          higher.
        </li>
      </ul>

      {/* ── 5. Purpose of Collection ── */}
      <h2>5. Purpose of Data Collection and Use</h2>
      <p>We collect and process personal data for the following purposes:</p>
      <ol>
        <li>
          <strong>Payroll processing:</strong> Calculating gross-to-net pay, allowances, deductions,
          overtime, and generating payslips.
        </li>
        <li>
          <strong>CPF calculation and submission:</strong> Computing employer and employee CPF
          contributions in accordance with CPF Board regulations.
        </li>
        <li>
          <strong>Statutory contributions:</strong> Calculating SDL, FWL, SHG, and other statutory
          levies.
        </li>
        <li>
          <strong>Tax filing:</strong> Preparing IR8A forms and Auto-Inclusion Scheme (AIS) data for
          IRAS submissions.
        </li>
        <li>
          <strong>Payment processing:</strong> Generating bank GIRO files for salary disbursement.
        </li>
        <li>
          <strong>Compliance:</strong> Meeting statutory requirements under the Employment Act, CPF
          Act, Income Tax Act, and other applicable Singapore legislation.
        </li>
        <li>
          <strong>Account management:</strong> Authenticating users, managing roles and permissions,
          and providing customer support.
        </li>
        <li>
          <strong>Service improvement:</strong> Analysing usage patterns to improve the Service
          (using aggregated, anonymised data only).
        </li>
      </ol>

      {/* ── 6. Legal Basis ── */}
      <h2>6. Legal Basis for Processing</h2>
      <p>We process personal data on the following legal bases under the PDPA:</p>
      <ul>
        <li>
          <strong>Contractual necessity:</strong> Processing is necessary to provide the Service as
          agreed in our{" "}
          <Link href="/terms" className="text-sky-600 hover:text-sky-700">
            Terms of Service
          </Link>
          .
        </li>
        <li>
          <strong>Legal obligation:</strong> Processing is required to comply with Singapore law,
          including CPF Act obligations, Employment Act requirements (e.g., itemised payslips), and
          Income Tax Act reporting.
        </li>
        <li>
          <strong>Consent:</strong> Where required, such as the collection of NRIC numbers,
          processing is based on the consent obtained by you (the employer) from your employees.
        </li>
        <li>
          <strong>Legitimate interests:</strong> Processing for security monitoring, fraud
          prevention, and service improvement, where such interests are not overridden by data
          subjects&apos; rights.
        </li>
      </ul>

      {/* ── 7. Data Retention ── */}
      <h2>7. Data Retention</h2>
      <p>
        We retain personal data for as long as necessary to fulfil the purposes outlined in this
        policy, subject to the following:
      </p>
      <ul>
        <li>
          <strong>Configurable retention:</strong> Companies can configure their data retention
          period to 5, 7, or 10 years via the Settings page, in accordance with their internal
          policies and statutory requirements.
        </li>
        <li>
          <strong>Statutory minimums:</strong> Regardless of your configured retention period,
          certain data is retained for the minimum statutory period required by law (e.g.,
          Employment Act requires payroll records to be kept for 2 years after an employee leaves;
          IRAS requires tax records for 5 years).
        </li>
        <li>
          <strong>Audit logs:</strong> Audit trail records are retained for the full statutory
          period and cannot be deleted early.
        </li>
        <li>
          <strong>Post-termination:</strong> Upon account termination, you have 30 days to export
          your data. After that period, data is deleted subject to statutory retention requirements.
        </li>
      </ul>

      {/* ── 8. Data Sharing and Disclosure ── */}
      <h2>8. Data Sharing and Disclosure</h2>
      <p>
        We do not sell personal data. We share personal data only in the following circumstances:
      </p>
      <ol>
        <li>
          <strong>CPF Board:</strong> CPF contribution data is submitted to the CPF Board as part of
          the payroll process, as required by the CPF Act.
        </li>
        <li>
          <strong>IRAS:</strong> Tax filing data (IR8A, AIS) is prepared for submission to the
          Inland Revenue Authority of Singapore, as required by the Income Tax Act.
        </li>
        <li>
          <strong>Banks:</strong> Employee bank account details are included in GIRO payment files
          transmitted to the designated bank for salary disbursement.
        </li>
        <li>
          <strong>Legal requirements:</strong> We may disclose personal data if required to do so by
          law, regulation, legal process, or governmental request.
        </li>
        <li>
          <strong>With your consent:</strong> We may share data with third parties where you have
          given explicit consent.
        </li>
      </ol>

      {/* ── 9. Third-Party Services ── */}
      <h2>9. Third-Party Service Providers</h2>
      <p>
        We use the following third-party services to operate the platform. Each has been selected
        for its security practices and data residency options:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> (payment processing) — Processes subscription billing. Stripe is
          PCI DSS Level 1 certified. ClinicPay does not store your credit card details.
        </li>
        <li>
          <strong>Neon</strong> (PostgreSQL database) — Stores application data. We use
          Singapore/APAC data regions where available.
        </li>
        <li>
          <strong>Upstash</strong> (Redis caching) — Used for session management and rate limiting.
          APAC region configured.
        </li>
        <li>
          <strong>Vercel</strong> (hosting) — Hosts the application. Singapore edge network used for
          low-latency access.
        </li>
      </ul>
      <p>
        We ensure that all third-party service providers are bound by appropriate data protection
        obligations and process personal data only as instructed by us.
      </p>

      {/* ── 10. Employee Rights Under PDPA ── */}
      <h2>10. Individual Rights Under PDPA</h2>
      <p>
        Employees whose data is processed through ClinicPay have the following rights under the
        PDPA. These requests should be directed to the employer (data controller) in the first
        instance:
      </p>
      <ol>
        <li>
          <strong>Right of access:</strong> Individuals may request access to their personal data
          held in the Service. Employers can facilitate this through the employee self-service
          portal or by exporting relevant records.
        </li>
        <li>
          <strong>Right of correction:</strong> Individuals may request correction of inaccurate or
          incomplete personal data. Employers can update employee records through the Service.
        </li>
        <li>
          <strong>Right to withdraw consent:</strong> Individuals may withdraw consent for the
          collection, use, or disclosure of their personal data. Note that withdrawal of consent for
          data required for statutory purposes (e.g., CPF, tax filing) may affect the
          employer&apos;s ability to process payroll.
        </li>
      </ol>
      <p>
        If you are an employee and your employer is unable to address your request, you may contact
        our Data Protection Officer directly (see Section 15).
      </p>

      {/* ── 11. Data Breach Notification ── */}
      <h2>11. Data Breach Notification</h2>
      <p>
        In the event of a data breach that is likely to result in significant harm to affected
        individuals or is of a significant scale, ClinicPay will:
      </p>
      <ol>
        <li>
          Notify the Personal Data Protection Commission (PDPC) within 72 hours of becoming aware of
          the breach, as required by the PDPA.
        </li>
        <li>
          Notify affected organisations (our customers) as soon as practicable so they can in turn
          notify affected individuals.
        </li>
        <li>
          Take immediate steps to contain the breach, assess the scope and impact, and implement
          remedial measures.
        </li>
        <li>
          Maintain a record of the breach, including the facts, its effects, and the remedial
          actions taken.
        </li>
      </ol>

      {/* ── 12. Cookies ── */}
      <h2>12. Cookies and Similar Technologies</h2>
      <p>ClinicPay uses the following cookies:</p>
      <ul>
        <li>
          <strong>Session cookie</strong> (<code>session_token</code>) — A signed, HTTP-only cookie
          used to authenticate your session. Essential for the Service to function. Expires when you
          log out or after the configured session timeout.
        </li>
        <li>
          <strong>CSRF token</strong> — A security token used to prevent cross-site request forgery
          attacks. Essential for secure operation.
        </li>
      </ul>
      <p>
        We do <strong>not</strong> use third-party tracking cookies, advertising cookies, or
        analytics cookies by default. No personal data is shared with advertising networks.
      </p>

      {/* ── 13. International Data Transfer ── */}
      <h2>13. International Data Transfer</h2>
      <p>
        We store and process data primarily in Singapore and the Asia-Pacific region. Where data may
        be transferred to servers outside Singapore (e.g., for infrastructure redundancy), we ensure
        that the receiving jurisdiction provides a comparable standard of data protection, or we
        implement appropriate contractual safeguards in accordance with the PDPA.
      </p>

      {/* ── 14. Children&apos;s Privacy ── */}
      <h2>14. Children&apos;s Privacy</h2>
      <p>
        The Service is designed for business use and is not intended for individuals under 18 years
        of age. We do not knowingly collect personal data from children. If you become aware that a
        minor&apos;s data has been provided to us without appropriate consent, please contact our
        Data Protection Officer immediately.
      </p>

      {/* ── 15. Changes to This Policy ── */}
      <h2>15. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time to reflect changes in our practices or
        applicable law. We will provide at least 30 days&apos; notice of material changes by email
        to the account owner and by posting a notice within the Service. The &quot;Last
        Updated&quot; date at the top of this policy indicates when the latest revision was made.
      </p>

      {/* ── 16. Contact ── */}
      <h2>16. Data Protection Officer</h2>
      <p>
        If you have any questions, concerns, or requests regarding this Privacy Policy or our data
        protection practices, please contact our Data Protection Officer:
      </p>
      <ul>
        <li>
          <strong>Email:</strong> <a href="mailto:dpo@clinicpay.sg">dpo@clinicpay.sg</a>
        </li>
        <li>
          <strong>General support:</strong>{" "}
          <a href="mailto:support@clinicpay.sg">support@clinicpay.sg</a>
        </li>
        <li>
          <strong>Company:</strong> ClinicPay Pte. Ltd.
        </li>
        <li>
          <strong>Address:</strong> Singapore
        </li>
      </ul>
      <p>
        You may also lodge a complaint with the Personal Data Protection Commission (PDPC) if you
        believe that your personal data has been handled in a manner that is inconsistent with the
        PDPA. Visit{" "}
        <a
          href="https://www.pdpc.gov.sg"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-600 hover:text-sky-700"
        >
          www.pdpc.gov.sg
        </a>{" "}
        for more information.
      </p>
    </article>
  );
}
