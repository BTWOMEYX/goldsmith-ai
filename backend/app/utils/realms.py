from app.services.blizzard import blizzard_service


async def get_realm_display_name(connected_realm_id: int) -> str:
    try:
        realms = await blizzard_service.get_connected_realms_summary()

        for realm in realms:
            if realm.get("connected_realm_id") == connected_realm_id:
                realm_names = realm.get("realm_names", [])

                if len(realm_names) == 1:
                    return realm_names[0]

                if len(realm_names) > 1:
                    return " / ".join(realm_names)

                return realm.get("name") or realm.get("label")

    except Exception as error:
        print(
            "[REALM NAME WARNING] Falling back for "
            f"connected_realm_id={connected_realm_id}: {error}"
        )

    return f"Connected Realm {connected_realm_id}"