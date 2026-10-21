# WattWise hardware accuracy and safety research

**Purpose.** This note separates the accuracy of the *energy meter* from the
reliability and safety of the rest of a WattWise unit. It is suitable for a
thesis/demo claim, but it is not a substitute for product certification or an
electrician's inspection. Reviewed: 25 August 2026.

## Bottom line

The PZEM-004T V3 is the component that determines WattWise's voltage, current,
power, and kWh accuracy. Its manual claims **0.5% accuracy** for voltage,
current, active power, and active energy. That is a useful prototype target,
not proof that every assembled WattWise unit is accurate to ±0.5% in the field.
The manual does not state the error basis, calibration traceability, reference
conditions, or an IEC/MID billing-meter class. WattWise should therefore be
presented as an **appliance energy-monitoring and budget-management system**,
not as a replacement for a utility revenue meter, until units have been
validated and certified for that use.

The ESP32-S3 does not add a measurement error in the current design: firmware
reads the PZEM digitally over `Serial2`; it does not calculate kWh from an
ESP32 ADC. The relay and AC-DC supply also do not affect kWh math directly,
but they are the critical reliability and electrical-safety limits.

## Component findings

### PZEM-004T V3 energy meter

The available PZEM-004T V3 user manual gives the following **manufacturer
claimed** specifications. Confirm whether a physical unit is the 10 A
built-in-shunt model or the 100 A external-current-transformer (CT) model
before using the applicable range.

| Quantity | Range / start point | Resolution | Claimed accuracy |
| --- | --- | --- | --- |
| Voltage | 80–260 VAC | 0.1 V | 0.5% |
| Current, 10 A version | 0–10 A; begins at 0.01 A | 0.001 A | 0.5% |
| Current, 100 A CT version | 0–100 A; begins at 0.02 A | 0.001 A | 0.5% |
| Active power | 0–2.3 kW (10 A) / 0–23 kW (100 A); begins at 0.4 W | 0.1 W | 0.5% |
| Active energy | 0–9999.99 kWh | 1 Wh | 0.5% |
| Power factor | 0.00–1.00 | 0.01 | 1% |
| Frequency | 45–65 Hz | 0.1 Hz | 0.5% |

Source: [PZEM-004T V3.0 user manual, pp. 1–2](https://mathieu.carbou.me/MycilaPZEM/PZEM-004T-V3.0-Datasheet-User-Manual.pdf).

Practical interpretation:

- **Resolution is not accuracy.** A kWh value can change in 1 Wh steps while
  still having a larger real-world error.
- Do not write “±0.5% guaranteed” in a defense or product claim. The manual
  says “0.5%” but does not state whether that is percent of reading or full
  scale, nor its load, temperature, power-factor, or calibration conditions.
- The module's calibration command is documented as internal/factory use.
  Treat a unit that disagrees with a reference meter as a unit to investigate,
  not something to silently correct with an arbitrary software multiplier.
- Small standby loads sit nearer the start thresholds, so their percentage
  error can be materially worse than a mid-range resistive-load test suggests.
- A CT installation must follow the module's physical wiring instructions and
  be checked with one known load. Incorrect conductor placement/orientation or
  measuring the wrong circuit invalidates the comparison.

### ESP32-S3 controller

Current WattWise firmware uses the PZEM library and `Serial2` (intended PZEM
RX GPIO 4 / TX GPIO 5) and only sends the PZEM readings to Supabase. It does
not read mains voltage/current through the ESP32 ADC. Consequently, ESP32 ADC
accuracy is **not part of the present WattWise kWh-accuracy budget**.

If a future design uses direct analog sensing, Espressif's ESP32-S3 datasheet
states its ADC conditions and calibrated errors separately: the published
figures are at 25 °C with Wi-Fi disabled and a 100 nF external capacitor; the
calibrated total-error limits range from ±5 mV to ±50 mV depending on
attenuation/range. Espressif also recommends filtering/averaging and, where
needed, additional calibration. See [ESP32-S3 datasheet, ADC characteristics](https://documentation.espressif.com/esp32_s3_datasheet_en.pdf)
and [ESP-IDF ADC guidance](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/adc/index.html).

### Single-channel relay module

A relay does not measure electricity; it merely opens or closes the appliance
circuit. The actual relay model on each WattWise board must be identified from
its printed part number. If it is the common **Songle SRD-05VDC-SL-C**, the
relay datasheet rates resistive AC loads differently by contact form: Form C
is 7 A at 240 VAC and Form A is 10 A at 240 VAC. Its stated inductive ratings
are lower and only specified at 120 VAC (3 A Form C / 5 A Form A). It lists a
250 VAC maximum voltage, 10^7 mechanical operations, and 10^5 electrical
operations at rated conditions. Source: [Songle SRD datasheet](https://naylampmechatronics.com/img/cms/000263/SRD-05VDC-SL-C-Datasheet.pdf).

That means the popular board label “10 A 250 VAC” must **not** be treated as a
universal appliance rating. Aircons, refrigerators, pumps, and compressors are
inductive loads with startup/inrush current. Do not use a bare low-cost relay
module as the final switching device for those loads or near its stated limit.
Use a suitably rated contactor or appliance-rated SSR, an appropriately sized
protective device, surge suppression where designed for the load, correct
wire/terminal ratings, earthing, an insulated flame-rated enclosure, and
qualified electrical review.

### Hi-Link AC-DC power module

The current hardware repository does not identify a power-supply SKU, so these
figures apply **only if the installed board is an HLK-PM01**. Hi-Link's 3 W
family datasheet lists the HLK-PM01 as 5 V, 600 mA (3 W), with 85–265 VAC
input, nominal 5.0 ±0.1 V no-load / 5.0 ±0.2 V full-load, short-term output
at least 700 mA, and specified ripple/noise up to 100 mV peak-to-peak under its
test conditions. It also claims 3000 VAC input/output isolation, automatic
short-circuit recovery, and recommends an external 1 A / 250 VAC fuse or a
10-ohm slow-blow wire-wound resistor. Source: [Hi-Link 3 W module power-supply datasheet](https://hilinkpower.com/Uploads/ProductClass/4gvpx3a5es1vz.pdf).

The PSU affects availability and safe operation, not the PZEM's nominal kWh
accuracy. Still, inadequate supply headroom, poor 5 V-to-3.3 V regulation,
relay-coil transients, or mains surges can reset the ESP32 and create telemetry
gaps. Test the actual enclosure under Wi-Fi transmission and relay switching;
do not infer finished-product UL/CE/IP certification from a component data
sheet or a generic marketplace listing.

## Recommended accuracy validation for the WattWise demo

1. Identify and photograph each PZEM variant, relay part number, PSU part
   number, CT rating, and firmware version.
2. Have a qualified person make the mains connections and use a known-good,
   calibrated plug-in energy meter or suitable reference instrument on the
   same appliance circuit.
3. Compare **cumulative kWh**, not a single instantaneous watt reading, over
   at least three representative loads: a resistive load, a small standby
   load, and the intended appliance type. Record starting/ending values,
   elapsed time, supply voltage, and load description.
4. Calculate `percent difference = (WattWise kWh - reference kWh) / reference
   kWh × 100` for each test. Do not divide when the reference energy is zero.
5. Report the observed range and sample conditions, e.g. “within X% versus
   our reference meter across these test loads,” instead of generalising the
   PZEM data-sheet claim to all installations.
6. Repeat after a reboot/Wi-Fi outage to verify that WattWise's cumulative-log
   handling does not introduce a data error distinct from meter accuracy.

## Claim language safe for a presentation

> WattWise uses a PZEM-004T V3 energy meter. Its published manual claims 0.5%
> accuracy for voltage, current, active power, and active energy. In our
> prototype, we validate each unit against a reference meter under documented
> loads. WattWise is designed for appliance monitoring and budget awareness;
> it is not presented as a utility billing meter.

## Source-quality note

The PZEM manual is a vendor-distributed technical manual rather than an
independent certification report. The ESP32-S3 material is first-party
Espressif documentation. The relay and PSU sources are component data sheets;
they do not certify the final assembled WattWise device. Keep the exact
component labels and any supplier certificates with the physical unit's test
record.
