// Fixed RSA keys for tests that need a key but don't exercise key generation itself.
// RSA key generation is slow and highly variable on Debug and sanitizer builds (constant-time
// prime generation since mbedtls 3.6.7 takes seconds per 2048-bit key), so generating keys per
// test case blows the test timeout. These are throwaway test keys; never use them elsewhere.
const keys = {
    rsa2048: {
        pkcs8:
            'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDIiZICJcVOuJ07C0LCYZeYcKLSfqyJbCxHvN59WaBADY62' +
            'lOQJxblUwbUZQxp0uaSAWC1fnCCBTIg11mkagJVCvVUCoZCcGKGrN5sCtADfhwxOVTxmNIRlmk4w6hoCQOA637j81EWohBlV' +
            'x3750cy8Y35Yb2eyH300n6NoNf3Bu6zftfVuu9/kjF7JOt+khsMld0WCRbpvQTzjXfp7RUQkDFGcZ3CvuH+3TaDmCP/gG+bn' +
            'FPa/L9iGwz9U+sOLCJ0bZntH0CjEQeK95t5x08o6/teyaNwPClobxuVwZfwT8t9PTf3+VKLU0bpwxalZF9OPQl5G9hfwXqgv' +
            'abnI6+hdAgMBAAECggEADmC0p/RCzvfUCA9w4CRknNCYj+x2nNy1WQhc0FJsd6MxM/x9VAkJ1l6UCCVkQHGt7mjECgqU1whg' +
            'bLG8c+K7sN8HuQpR5qsqbi7srXcv59bUJkqcq7xAsNMtH3stVbOGkBoJtpDWlLQx59FHlIw6+FfOz3LfValFzg/TBK34TVsx' +
            'eQwpDP0ly+6SPTZmC3atmjlwf3Nen28DehLZNETFEPoKA9Idj8jpd9tnDHDbT2QAhuZxcn4AnK6TvO8pOFGBetjv+4kZrTnD' +
            'lEKssqpiGnvWNARvS1wYQKACZQ6yP3acJRMuoYrOXj/sQDYxx3hp1/PZKtN3cLkfN6Bvalvt4QKBgQD2ggAjTrJeXDgJHRzS' +
            'KLdfCrrQ/4maX6iqz451OPKjizz9ooAe5hkApoflBJh3y5Q5YaQNGb7bm72fHY7YUyrUTiAxWuJZ9Mc8psPOiR8ijBUPl/k6' +
            'kMhhDAsw7VZnAFy6Jqe8+Dvl17Wn3QooCHUeM0AfPpLGM5pSKnK4XZZSYQKBgQDQQmg+8ipl3VtQDwzc7vzd5FVAxZeassOM' +
            'coLHwyXybhADTwoEheqPPu0aSzkACY/eSdo1ZOjUkExVwHbgAnKPXyEBNNPqxP6TSuUsFdAWAQyIBq25Vywo/oChndIKjzqU' +
            'z413gf5RrqcLQWYMuhb4hDhXRJx0/ap5QY4HaPIPfQKBgCk8V++QE5BrVshXgWG6g+o3LkcV6BvV0q44KDl9vEEVYq9/BnWk' +
            'whv0v5jU6vhnKrVqmvnCC8ZKyC6c0C9pwilfpEz9Sg4IP2fq8ahUEcxCqKdCIePlIk/xptGZcjGqwtg07SxUThjFu9KHzFIk' +
            'EAtsQVa4re7P5QnHpgcnSKUhAoGAKYoVYPjMnCTa4c0es7K3nUq99n1zD9g4SPtOOqoiF4j8iKxrQxuy/X9/q471f5xopd31' +
            'OFE4X62ojDIng+b5Er/WxXbUDi/c12RI8dIn/zuWVEuAu0c397VL0vC3xINtG+GKRhwXrhM4Hnac9Ezp6Af3dPCqhGtUZXs9' +
            '6Rx1q8ECgYAOQi1iKcONwOzZ8l25gVRSUOI9E6sdL+ykn9eiv0M0lph+rkzPW7RDFS7q+f2K02wncwzorlion5W+opJWCa9i' +
            'n8SN95LOIpmv9XuRs1izxVj8HinKuMqptQqdTY6LUBv6y6ooCu3qq93uIOFHK2L1WMDL9FJeFQtCgL9MpL03kw==',
        spki:
            'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyImSAiXFTridOwtCwmGXmHCi0n6siWwsR7zefVmgQA2OtpTkCcW5' +
            'VMG1GUMadLmkgFgtX5wggUyINdZpGoCVQr1VAqGQnBihqzebArQA34cMTlU8ZjSEZZpOMOoaAkDgOt+4/NRFqIQZVcd++dHM' +
            'vGN+WG9nsh99NJ+jaDX9wbus37X1brvf5IxeyTrfpIbDJXdFgkW6b0E84136e0VEJAxRnGdwr7h/t02g5gj/4Bvm5xT2vy/Y' +
            'hsM/VPrDiwidG2Z7R9AoxEHivebecdPKOv7XsmjcDwpaG8blcGX8E/LfT039/lSi1NG6cMWpWRfTj0JeRvYX8F6oL2m5yOvo' +
            'XQIDAQAB',
    },
    rsa2048b: {
        pkcs8:
            'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCmSOSSB71zbJVsuzK2UjO7IBwEZ7zXJTNMMLFx3cC77R2P' +
            'yglFcEWJs0vWjlaGoAh/yOhQzIf+c6QJi0YTNOn17E+mIxm7CjmsZ3y9lk5YK7fxLtEeHcxTE/zu+04CsUN7msgCGKNW6VWe' +
            '6azPVWg77tH62kCRxKHIu4gdO2dfsscItxAwnvcT3ODJq/u4mTUYvbaVO19VTB3Qjy/UcrU82FD5/MAiKG9LFOpAIcMku0z+' +
            'XMWPpY5UKMwc8Xpv0vUHF/snx6Brk7Cz2WGK8z1k4K8KpeEnlQ63WYNgx/JteNHQt3ZkbaGX7V94fAsWuFx4DKaQfqObMRQ3' +
            'wBAKMidtAgMBAAECggEAH/6I+h8CoP2Mv6PCJWnqGbBbK67RGx1FgjyhO7002wPLyxGO2J06R/0nU6RF+je7AulDZ95+sSML' +
            'dimlxUbKWF7MUXVR+1bDk4xC6FCOCPF6fi2pn0+Q85A2O74/O43jY9o7bwnSDcQuDPo9nZP7jwKLxOYvA80PaunITgWSxYr3' +
            'UJMbo0vlFaPlYyzXYXyG6IKYjZFbx1wr91yFSui25ReHI+gAjdzgIvwgKb8YSaq5zkegbav25EH+dkOeDGrsv6qk7y1uMEo8' +
            '/ZjWQiFi4eVYKih1YwRAi+mvv0fZe4SCJZwfVLm9MF7dX2hvepKnTW/lzZFLBNZ3O60CuJEA8QKBgQDRXZESIwDSVvC6wBgA' +
            'rloRVS3v4kT/14ibZ/CicbBXftsaGct7fLxNL+hyjdDJuqJlJ9gCnR8FW39DVxZ2mcDMvKSp8FRO1OxmLX1NF52R5j9Pb4q7' +
            '6DuKZTpS4Lj/iscH8GmG/CeqAPnjFuWz8Ct+9QOXRRobjcT6NPhw9+mrvQKBgQDLUsbF2tUOnQn4psJ8WGpS269ifH6duMrE' +
            'B0CeN6SsfIXKJ/iyuE3wgGxhKgka+mL6I88JTAnCWtQfdRambVmXPjxt7pXMgth0zS+TiPp7/OcUCu+L7I+3WIw05CJH5Y/y' +
            'gftrf/GYRU0sjzBbXO+a+eICcGqDffXTxin4YJPNcQKBgCDReukN5ZYTHL8ZV2nb6rBm2sGMhWZZQceiflzoV00PzIaF3pin' +
            'z9iFlvlF86F7iPM0UK7wNCmh0wwaPaIvrcIqG+Grk3ub8sZ9gPOxrPhu0CPCh0u3NoYWIhNVuIoOFe7Pp6sKIamLZ6BKOY2A' +
            'K0FGZN60bUg+a88QuJT0t4M9AoGAdyOf+dvKsG9wolUE7VvZoYe881bD0qOvnMIrKQqt4axtsRFO91prwRtfZmf9QeOqD6zf' +
            '6jC2Hz6dwXkYtpiowKjlO/1rpZSeRYLd9/Nx4ylENkhaKYGKjQLD1VJAjCSF/rIPouQrqvAg0pVs3nxMomD+ADPjFf2/CEK7' +
            '4SCmOuECgYEAvmT5WRPUwDB/TE6xuOWO4+ei0wbktN3WJPGZRTWwIEW1hbz1JojJhlSkw6pD9I/R0lo25McKiQyc7239aqKU' +
            'NF9MzLHOwZ51ZLDRA0n3jv7AKY9Y4FkM80rJIb38EPbCWCMeaCNH2NB8cW04DLdzBM7r2IFEFp/ZrAnhr6zcJ1I=',
        spki:
            'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApkjkkge9c2yVbLsytlIzuyAcBGe81yUzTDCxcd3Au+0dj8oJRXBF' +
            'ibNL1o5WhqAIf8joUMyH/nOkCYtGEzTp9exPpiMZuwo5rGd8vZZOWCu38S7RHh3MUxP87vtOArFDe5rIAhijVulVnumsz1Vo' +
            'O+7R+tpAkcShyLuIHTtnX7LHCLcQMJ73E9zgyav7uJk1GL22lTtfVUwd0I8v1HK1PNhQ+fzAIihvSxTqQCHDJLtM/lzFj6WO' +
            'VCjMHPF6b9L1Bxf7J8ega5Ows9lhivM9ZOCvCqXhJ5UOt1mDYMfybXjR0Ld2ZG2hl+1feHwLFrhceAymkH6jmzEUN8AQCjIn' +
            'bQIDAQAB',
    },
    rsa4096: {
        pkcs8:
            'MIIJQQIBADANBgkqhkiG9w0BAQEFAASCCSswggknAgEAAoICAQCxlPrlUxUd7oVXH5zv2jJdrnZzP39DtnyhBbfcYcV3VBcU' +
            'KD6r1bLyLadgRsXo1j4d0TFsXgP/2cgkKtg64dnRe8FIodMCGl1JyXFngwRNham6V1TCbxICjLsh3+1wbEEpQ1++i6lVVMSB' +
            'ZG7Br61GaZrYgFyI0kQri7BDnnTNSnl14vxCz2kyZB83pmGrMu4ox+b69ZsiTzlsWHZUGHPbWK3kw3jJfP/z2hTWeS+IcjjM' +
            'wNH8EEQwKr7502ii+62nMlk12vduC2CqakyhZ3VTPagOkY/kJFeUZ/hwiyj5vP7YdfU3lAlo5tyLS9W/rLNwru3dAE3kJq1W' +
            '1mmKvzGoAl4lQvw4w/Gu7oFcTmfeD1y41Gt6tCPqCu2U+jACWD6cguThfnD+BP7NwmQat9HSdnNsVdLt0/Gmbk5n/ME+i4wJ' +
            'H9ggd6QfB1ZIAN5elfvaaOQZAqSXbbYPN9RNdgSLjb/d0UDfuLm6kyBKUI7+XVOp0B9ZdNuQI2XNJScp7LmtDyJAPSrz9e28' +
            'cr89uo21lxOtSmsDgha+3FpMA5T001ACowNb9ByY3Rwp1tp/SxvV/DNutx21mdnot2eQZHR2HD7MLbZKVSnqjwQL8bgEhaQA' +
            'VXWb1OFK40XwNbTBiEREO5G8ZeCwoCZN0p4nFPBiZNv3a8htWm3PBIpFcTZeBQIDAQABAoICAEHy3Gxe+vgnNRDCdkNjCpJc' +
            '8LNjMO2iL02TdJEdJDrpGTsMqR2imrayuraYAfay3dWv80VV8vFI3TmFSdEwP/a6mXDSXC0rQlrdO0bgUrBBg+NmfF1K52rX' +
            '/cUaRrEaGubqlPuMHWJJvUJ6XGGEzvpXzMA7h2HuiI+NbHPoPGNjFZFwrxNWuLAUm71MhngQTX8Koh6wKKFIv8AbaDJZ9GjQ' +
            '2Z+b8lcNm3ZhlpyB2+O12586uqD8H36t2UepOfJROk/d9GB6RapyAj+3g2brp5g2zRs/9qqYzoeYRxzwqVJ53EDiKaOu0AHL' +
            'vrriemqZBfjCliadbs/ch0I5FXAICjXGfB1A9aFUnly8dUfRXMM960+ADoihg5sn8MMw4OesvesX1a8FN/ZTo/tw9EU2yEOL' +
            'XbArGkbrrgiA3NvI50z+JREAu2peJb2KltAtUXxT2hwbeN6SKIqW9hV5nonMQxNcIIJlgNCf/j5clAJF273fdOBbWRai2Dco' +
            'tjWJxWQh0m4R5HfcsqJ+ECyaNQJpuhWhyv+uKtMGGmkthslrMb/EcFL3uZnGEb2h/fgZD8jkx8B7WCsXWrQFSWfZX8ySPiNM' +
            '/KFMYkpRColqerj4V5yH0AmCcy0l4vPom3aUfywGhJMsCgMP4P3dj92SEenvPCUoAJZmU3eXYLQUNnuanpUvAoIBAQDmEjKE' +
            '9iacMflgNI+lXLZAhPrtcyUudrC1HM1nuWH7HdCyEfpMjbYQl80zW9w2QdBd9VgXleR9eff4XYkdImryyCzjHQmJ8riYM7jJ' +
            'J9ZyL0a+VgTn73mcjYsMik1OLD+D8nC0GFwmRUS89JL7dHB7sBIaNEDvt7KZCtcxI+97l39ZNtFaxO1x/LryW/R+54H+3Ld2' +
            'SGhWhn61HHnbVjY1/VQY5/RyBTeVlo3hUWMIiwqBGyQMPDJ/oIcqEWRUH8uu+uG9Wp0KYz/UvcguqE9k0L8ymWzlN0/Nzea1' +
            'XLnpUAGyCQ4DB7IeoAPOi8azmbUqZadbGHjy3L3b410AQB83AoIBAQDFmGnyEHXAJY3nWQ4+6w7JyxwzR7KyureYuTDdPgmO' +
            'T46bY0zQNwWsJhfB7ZggeTTQSX4N5u7tPiZOttxMjWzSpumPkDtM1ytezTSuCtb9+dZqIsUuC1JsogZHTJggWMArOyR8HDC+' +
            'DKluSbn5U3YM0cETqHvELuTQi6BZnso4Q/2mKFY2QCWhukBD+t/v2rHWMUaAm/Q0BVkZHvtXhJTSw/xurgjvq8UvZadUP72I' +
            'CZxXjUr2NxnYhFqrkI9THqy9UieSOeUu1Jadz3oFHusZNul+EVTT57RU8BCctYg3QMX9GhnhEnVaEWR3AsXDw0uRzGVKw/4y' +
            '4JixhAE/ZHKjAoIBAGSelMWduakaGgw/MIuLjpGNFwj+EMbPVdz/qb2xT+65TWpzflo4p+V93lqV1CtOgUh2Yn5+KZ3O1+oh' +
            'TjQVt1xSu37gVimko6K9DBW9fIYXswLPL/oXu8ICDUwAuGp145lbUHsTJEoAhV12QUoD1KXjjSc0rymn104jdZWiN7x/t0xX' +
            'MxxVf9sYQtJ38OgHa80AzqPGawtcatHekFSi0bavAjaaS0gKjBK583cVVxCHbqKkMhG/yf4TQMnfLVe1SClQw6VCmefPHD14' +
            'erIdHgvjV5tTilJ87EP/xuSOlyg4u2UXnK8qkHXgWYndi5tEn/zY1GZ8v3jHnakrOKNBZ+UCggEARb2MrzYmCUJ3+k6RW52l' +
            'I43/jw3gQXrrcAj0+TF7N/JWd/utUdQJuX/cZMMSLWv6OwWlawy2CaAk7yVVTeOgpBzrVJNoiq9rDFPLIx6KUSvMBLvu8lhm' +
            'qBbrtmCPVONeOCPwtalRftKDPnzhGeHeSZoC1ohh3pVah0ywtND5uLAup2WXQCCV56YQJq42Obbri5jqtFvW7kFw+A/aUEJo' +
            'MJeh0gK0/rqWpyruyyqQH6Kcvr4M1igOhD/6rJEiNQkfmNaVRuQOQuAfpOVkwMfv3H9oG+nMEdq26D+u7VCZGj9PYgzDU5Ar' +
            'QTXgSqz81iJo2rXUjnXsk1J4MjdQJWqzlwKCAQBuS0za0yzMC9QTCyuvj18sl8RXZUA/QxHbx0MCFGe2/wvtyyDyo1IQ6peO' +
            'oRLAR42GE3YpqbXyaUAl860yJQqRxIY0QeKADAe/O5ut/g4llQ9Vjf4FnBrZMLhMpTTuzetdVQHSemccOEo+yDaa7QKDTCy2' +
            'PZhHqj2TavDIkrHxkFGgsVmGS3LixeTXnQGo8QDkpaY/v6NwlZFZw7X/aX20K662eKXPnwsgXJ+fN5CgKAfEiozqFh8/T11v' +
            'jpkpW1ywUPQISsMC2cbhuqB5MTUYYyjPwr4lzoodQSV0leoEMwAEcKn2MkgWlcUrdxD3p8vWELuljsafGBSev6wrEA68',
        spki:
            'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAsZT65VMVHe6FVx+c79oyXa52cz9/Q7Z8oQW33GHFd1QXFCg+q9Wy' +
            '8i2nYEbF6NY+HdExbF4D/9nIJCrYOuHZ0XvBSKHTAhpdSclxZ4METYWpuldUwm8SAoy7Id/tcGxBKUNfvoupVVTEgWRuwa+t' +
            'Rmma2IBciNJEK4uwQ550zUp5deL8Qs9pMmQfN6ZhqzLuKMfm+vWbIk85bFh2VBhz21it5MN4yXz/89oU1nkviHI4zMDR/BBE' +
            'MCq++dNoovutpzJZNdr3bgtgqmpMoWd1Uz2oDpGP5CRXlGf4cIso+bz+2HX1N5QJaObci0vVv6yzcK7t3QBN5CatVtZpir8x' +
            'qAJeJUL8OMPxru6BXE5n3g9cuNRrerQj6grtlPowAlg+nILk4X5w/gT+zcJkGrfR0nZzbFXS7dPxpm5OZ/zBPouMCR/YIHek' +
            'HwdWSADeXpX72mjkGQKkl222DzfUTXYEi42/3dFA37i5upMgSlCO/l1TqdAfWXTbkCNlzSUnKey5rQ8iQD0q8/XtvHK/PbqN' +
            'tZcTrUprA4IWvtxaTAOU9NNQAqMDW/QcmN0cKdbaf0sb1fwzbrcdtZnZ6LdnkGR0dhw+zC22SlUp6o8EC/G4BIWkAFV1m9Th' +
            'SuNF8DW0wYhERDuRvGXgsKAmTdKeJxTwYmTb92vIbVptzwSKRXE2XgUCAwEAAQ==',
    },
};

function decode(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function importRsaKeyPair(name, algorithm, extractable, publicUsages, privateUsages) {
    const { pkcs8, spki } = keys[name];

    return {
        publicKey: await crypto.subtle.importKey('spki', decode(spki), algorithm, true, publicUsages),
        privateKey: await crypto.subtle.importKey('pkcs8', decode(pkcs8), algorithm, extractable, privateUsages),
    };
}
